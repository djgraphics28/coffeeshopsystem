<?php

namespace App\Actions\Menu;

use App\Models\MenuItem;
use App\Models\OrderItem;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * The storefront's best sellers, ranked by quantity actually sold.
 *
 * Counts every order that wasn't cancelled or voided over the last 30 days. When
 * the café doesn't have enough recent sales yet it falls back to all-time sales,
 * so the section is never half-empty. Only items that are still available show.
 */
class BestSellers
{
    public const RECENT_DAYS = 30;

    /** Rankings are cached for ten minutes — fresh enough for a storefront, cheap on busy days. */
    public const CACHE_KEY = 'storefront.best-sellers';

    /**
     * @return Collection<int, array{menu_item: MenuItem, sold: int, period: string}>
     */
    public function handle(int $limit = 6): Collection
    {
        $ranked = Cache::remember(self::CACHE_KEY.".{$limit}", now()->addMinutes(10), function () use ($limit) {
            $recent = $this->ranking(now()->subDays(self::RECENT_DAYS), $limit);

            if ($recent->count() >= $limit) {
                return ['period' => 'month', 'ranking' => $recent->all()];
            }

            return ['period' => 'all-time', 'ranking' => $this->ranking(null, $limit)->all()];
        });

        $items = MenuItem::available()
            ->with(['category', 'variations', 'addonGroups.addons'])
            ->findMany(array_keys($ranked['ranking']))
            ->keyBy('id');

        return collect($ranked['ranking'])
            ->filter(fn (int $sold, int $menuItemId) => $items->has($menuItemId))
            ->map(fn (int $sold, int $menuItemId) => [
                'menu_item' => $items->get($menuItemId),
                'sold' => $sold,
                'period' => $ranked['period'],
            ])
            ->values();
    }

    /**
     * Menu item id => quantity sold, best first.
     *
     * @return Collection<int, int>
     */
    protected function ranking(?CarbonInterface $since, int $limit): Collection
    {
        return OrderItem::query()
            ->selectRaw('menu_item_id, SUM(quantity) as sold')
            ->whereHas('order', function ($query) use ($since) {
                $query->whereNotIn('status', ['cancelled', 'voided']);

                if ($since) {
                    $query->where('created_at', '>=', $since);
                }
            })
            ->whereHas('menuItem', fn ($query) => $query->available())
            ->groupBy('menu_item_id')
            ->orderByDesc('sold')
            ->limit($limit)
            ->pluck('sold', 'menu_item_id')
            ->map(fn ($sold) => (int) $sold);
    }
}
