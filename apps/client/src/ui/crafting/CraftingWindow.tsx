import {
  CRAFTING,
  type CraftReason,
  contentNameKey,
  countInSlots,
  craftableCount,
  type Inventory,
  type RecipeDef,
} from '@8box/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../../game/client';
import { content } from '../../game/content';
import { closeCraftingWindow, useCraftingStore } from '../../store/crafting';
import { useInventoryStore } from '../../store/inventory';
import { ItemIcon } from '../inventory/ItemSlot';

/** Recipes made at the same place: by hand (`station` undefined), or at a station. */
interface RecipeGroup {
  station: string | undefined;
  recipes: RecipeDef[];
}

/** The recipes by place: by hand first, then each station in the order of the content. */
function groupRecipes(recipes: readonly RecipeDef[]): RecipeGroup[] {
  const groups: RecipeGroup[] = [{ station: undefined, recipes: [] }];
  for (const recipe of recipes) {
    let group = groups.find((candidate) => candidate.station === recipe.station);
    if (!group) {
      group = { station: recipe.station, recipes: [] };
      groups.push(group);
    }
    group.recipes.push(recipe);
  }
  return groups.filter((group) => group.recipes.length > 0);
}

const GROUPS = groupRecipes(content.recipes.all);

/** Why a recipe cannot be crafted now, as the client sees it (the server checks again). */
function blockedBy(
  recipe: RecipeDef,
  inventory: Inventory,
  stations: readonly string[],
): CraftReason | null {
  if (recipe.station !== undefined && !stations.includes(recipe.station)) {
    return 'noStation';
  }
  return craftableCount(inventory, recipe) === 0 ? 'missingItems' : null;
}

/** What a recipe gives, e.g. "Planche × 4". */
function useOutputLabel(recipe: RecipeDef): string {
  const { t } = useTranslation();
  const output = recipe.outputs[0];
  if (!output) {
    return '';
  }
  const name = t(contentNameKey(output.item));
  return output.count > 1 ? t('ui.crafting.output', { name, count: output.count }) : name;
}

function RecipeButton({
  recipe,
  blocked,
  selected,
  onSelect,
}: {
  recipe: RecipeDef;
  blocked: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = useOutputLabel(recipe);
  const classes = ['craft-recipe'];
  if (blocked) {
    classes.push('craft-recipe--blocked');
  }
  if (selected) {
    classes.push('craft-recipe--selected');
  }
  return (
    <li>
      <button
        type="button"
        className={classes.join(' ')}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <ItemIcon item={recipe.outputs[0]?.item ?? ''} />
        <span>{label}</span>
      </button>
    </li>
  );
}

/** The chosen recipe: its ingredients (held / needed), the quantity, and the craft button. */
function RecipeDetail({
  recipe,
  inventory,
  stations,
}: {
  recipe: RecipeDef;
  inventory: Inventory;
  stations: readonly string[];
}) {
  const { t, i18n } = useTranslation();
  const [count, setCount] = useState(1);
  const current = useCraftingStore((state) => state.current);
  const label = useOutputLabel(recipe);
  const reason = blockedBy(recipe, inventory, stations);
  const most = Math.max(1, Math.min(craftableCount(inventory, recipe), CRAFTING.maxCount));
  const amount = Math.min(count, most);
  const setAmount = (value: number) =>
    setCount(Number.isInteger(value) ? Math.max(1, Math.min(value, most)) : 1);
  const station = recipe.station === undefined ? '' : t(contentNameKey(recipe.station));

  return (
    <div className="craft-detail">
      <h3>
        <ItemIcon item={recipe.outputs[0]?.item ?? ''} />
        {label}
      </h3>
      <p className="craft-detail-where">
        {recipe.station === undefined ? t('ui.crafting.hand') : station} ·{' '}
        {t('ui.crafting.time', {
          seconds: new Intl.NumberFormat(i18n.language).format(recipe.timeMs / 1000),
        })}
      </p>
      <h4>{t('ui.crafting.ingredients')}</h4>
      <ul className="craft-ingredients">
        {recipe.inputs.map((input) => {
          const have = countInSlots(inventory, input.item);
          const need = input.count * amount;
          return (
            <li key={input.item} className={have < need ? 'craft-missing' : undefined}>
              <ItemIcon item={input.item} />
              {t('ui.crafting.ingredient', {
                name: t(contentNameKey(input.item)),
                have,
                need,
              })}
            </li>
          );
        })}
      </ul>
      <div className="craft-actions">
        <fieldset className="craft-count" aria-label={t('ui.crafting.count')}>
          <button
            type="button"
            className="craft-step"
            aria-label={t('ui.crafting.less')}
            disabled={amount <= 1}
            onClick={() => setAmount(amount - 1)}
          >
            −
          </button>
          <input
            className="craft-count-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={most}
            value={amount}
            aria-label={t('ui.crafting.count')}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
          <button
            type="button"
            className="craft-step"
            aria-label={t('ui.crafting.more')}
            disabled={amount >= most}
            onClick={() => setAmount(amount + 1)}
          >
            +
          </button>
        </fieldset>
        <button
          type="button"
          className="craft-button"
          disabled={reason !== null || current !== null}
          onClick={() => gameClient.craft(recipe.id, amount)}
        >
          {t('ui.crafting.craft')}
        </button>
      </div>
      {reason && <p className="craft-reason">{t(`ui.crafting.reason.${reason}`, { station })}</p>}
      {current && (
        <p className="craft-current" role="status">
          {t('ui.crafting.left', {
            name: t(contentNameKey(content.recipes.get(current.recipe)?.outputs[0]?.item ?? '')),
            left: current.left,
          })}
        </p>
      )}
    </div>
  );
}

/**
 * The crafting window (C, or the Craft button): the recipes by place (by hand, then at each station),
 * greyed when an ingredient is missing or the station is too far, and the chosen one in detail. It
 * shows what the client knows; the server checks every craft again.
 */
export function CraftingWindow({ touch }: { touch: boolean }) {
  const { t } = useTranslation();
  const open = useCraftingStore((state) => state.open);
  const stations = useCraftingStore((state) => state.stations);
  const inventory = useInventoryStore((state) => state.inventory);
  const [selected, setSelected] = useState(GROUPS[0]?.recipes[0]?.id);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        closeCraftingWindow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open || !inventory) {
    return null;
  }
  const recipe = selected === undefined ? undefined : content.recipes.get(selected);

  return (
    <section
      className={touch ? 'crafting crafting--touch' : 'crafting'}
      aria-label={t('ui.crafting.title')}
      data-inventory-ui
    >
      <header className="inventory-header">
        <h2>{t('ui.crafting.title')}</h2>
        <button
          type="button"
          className="inventory-close"
          aria-label={t('ui.crafting.close')}
          onClick={closeCraftingWindow}
        >
          ×
        </button>
      </header>
      <div className="crafting-body">
        <div className="craft-groups">
          {GROUPS.map((group) => (
            <section key={group.station ?? ''} className="craft-group">
              <h3>
                {group.station === undefined
                  ? t('ui.crafting.hand')
                  : t(contentNameKey(group.station))}
              </h3>
              <ul>
                {group.recipes.map((candidate) => (
                  <RecipeButton
                    key={candidate.id}
                    recipe={candidate}
                    blocked={blockedBy(candidate, inventory, stations) !== null}
                    selected={candidate.id === selected}
                    onSelect={() => setSelected(candidate.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
        {recipe && (
          <RecipeDetail key={recipe.id} recipe={recipe} inventory={inventory} stations={stations} />
        )}
      </div>
      <p className="inventory-hint">
        {t('ui.crafting.help', { reach: CRAFTING.stationReachTiles })}
      </p>
    </section>
  );
}
