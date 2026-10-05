<?php

namespace App\Actions\MenuItems;

use App\Models\AddonGroup;
use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Throwable;

/**
 * Reads a menu spreadsheet and creates / updates menu items, auto-creating unknown categories.
 *
 * A dry run executes the exact same code inside a transaction that is rolled back, so the
 * preview a user sees is guaranteed to match what the real import will do.
 */
class ImportMenuItems
{
    public const MAX_ROWS = 1000;

    public const MAX_SIZES = 4;

    public const MODE_SKIP = 'skip';

    public const MODE_UPDATE = 'update';

    public const DEFAULT_CATEGORY_ICON = '🍽️';

    private const MAX_PRICE = 999999.99;

    /** @var array<string, string> normalised header => field key */
    private const HEADER_ALIASES = [
        'category' => 'category',
        'categoryname' => 'category',
        'categoryicon' => 'category_icon',
        'icon' => 'category_icon',
        'itemname' => 'name',
        'name' => 'name',
        'item' => 'name',
        'description' => 'description',
        'price' => 'price',
        'baseprice' => 'price',
        'available' => 'available',
        'featured' => 'featured',
        'sendtokitchen' => 'is_kitchen',
        'kitchen' => 'is_kitchen',
        'iskitchen' => 'is_kitchen',
        'preparedinkitchen' => 'is_kitchen',
        'sortorder' => 'sort_order',
        'addongroups' => 'addon_groups',
        'addons' => 'addon_groups',
    ];

    /** @var array<string, Category> */
    private array $categories = [];

    /** @var array<string, AddonGroup> */
    private array $addonGroups = [];

    /**
     * @return array{summary: array<string, mixed>, rows: list<array<string, mixed>>}
     */
    public function handle(string $path, string $duplicateMode = self::MODE_SKIP, bool $dryRun = false): array
    {
        $rows = $this->readRows($path);

        $this->categories = Category::all()->keyBy(fn (Category $c) => $this->key($c->name))->all();
        $this->addonGroups = AddonGroup::all()->keyBy(fn (AddonGroup $g) => $this->key($g->name))->all();

        $results = [];
        $seen = [];
        $createdCategories = [];

        DB::beginTransaction();

        try {
            foreach ($rows as $row) {
                $results[] = $this->processRow($row, $duplicateMode, $seen, $createdCategories);
            }

            $dryRun ? DB::rollBack() : DB::commit();
        } catch (Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        $count = fn (string $status) => count(array_filter($results, fn ($r) => $r['status'] === $status));

        return [
            'summary' => [
                'dry_run' => $dryRun,
                'total' => count($results),
                'created' => $count('created'),
                'updated' => $count('updated'),
                'skipped' => $count('skipped'),
                'failed' => $count('error'),
                'categories_created' => array_values($createdCategories),
            ],
            'rows' => $results,
        ];
    }

    /**
     * @return list<array{row: int, cells: array<string, mixed>}>
     */
    private function readRows(string $path): array
    {
        try {
            $reader = IOFactory::createReaderForFile($path);
            $reader->setReadDataOnly(true);
            $spreadsheet = $reader->load($path);
        } catch (Throwable) {
            throw ValidationException::withMessages(['file' => 'This file could not be read. Please upload the Excel template (.xlsx) or a .csv file.']);
        }

        [$sheetRows, $headerIndex] = $this->locateDataSheet($spreadsheet);

        // Only plain row data is needed from here on; free the workbook's memory early.
        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        $columns = $this->mapColumns($sheetRows[$headerIndex]);

        foreach (['category' => 'Category', 'name' => 'Item Name'] as $field => $label) {
            if (! in_array($field, $columns, true)) {
                throw ValidationException::withMessages(['file' => "The \"{$label}\" column was not found. Please use the downloaded template and keep the header row."]);
            }
        }

        $data = [];

        foreach ($sheetRows as $index => $cells) {
            if ($index <= $headerIndex) {
                continue;
            }

            $mapped = [];
            foreach ($columns as $col => $field) {
                $mapped[$field] = $cells[$col] ?? null;
            }

            if (collect($mapped)->every(fn ($v) => $v === null || trim((string) $v) === '')) {
                continue;
            }

            $data[] = ['row' => $index + 1, 'cells' => $mapped];
        }

        if (count($data) > self::MAX_ROWS) {
            throw ValidationException::withMessages(['file' => 'A maximum of '.self::MAX_ROWS.' items can be imported at once. Please split the file.']);
        }

        if ($data === []) {
            throw ValidationException::withMessages(['file' => 'No items were found. Fill in the "Menu Items" sheet below the header row (the "Examples" sheet is not imported).']);
        }

        return $data;
    }

    /**
     * @return array{0: array<int, array<int, mixed>>, 1: int}
     */
    private function locateDataSheet(Spreadsheet $spreadsheet): array
    {
        $preferred = $spreadsheet->getSheetByName('Menu Items');
        $sheets = $preferred ? [$preferred] : $spreadsheet->getAllSheets();

        foreach ($sheets as $sheet) {
            $rows = $sheet->toArray(null, true, false, false);

            foreach (array_slice($rows, 0, 15, true) as $index => $cells) {
                if (in_array('name', $this->mapColumns($cells), true)) {
                    return [$rows, $index];
                }
            }
        }

        throw ValidationException::withMessages(['file' => 'The "Menu Items" sheet with the header row was not found. Please use the downloaded template.']);
    }

    /**
     * @param  array<int, mixed>  $headerCells
     * @return array<int, string> column index => field key
     */
    private function mapColumns(array $headerCells): array
    {
        $map = [];

        foreach ($headerCells as $col => $header) {
            $normalised = preg_replace('/[^a-z0-9]/', '', strtolower((string) $header));

            if ($normalised === '') {
                continue;
            }

            if (isset(self::HEADER_ALIASES[$normalised])) {
                $map[$col] = self::HEADER_ALIASES[$normalised];
            } elseif (preg_match('/^size(\d)(name|price)$/', $normalised, $m) && (int) $m[1] >= 1 && (int) $m[1] <= self::MAX_SIZES) {
                $map[$col] = "size_{$m[1]}_{$m[2]}";
            }
        }

        return $map;
    }

    /**
     * @param  array{row: int, cells: array<string, mixed>}  $row
     * @param  array<string, int>  $seen
     * @param  array<string, string>  $createdCategories
     * @return array<string, mixed>
     */
    private function processRow(array $row, string $duplicateMode, array &$seen, array &$createdCategories): array
    {
        $cells = $row['cells'];
        $errors = [];
        $warnings = [];

        $categoryName = $this->text($cells['category'] ?? null);
        $name = $this->text($cells['name'] ?? null);

        if ($categoryName === '') {
            $errors[] = 'Category is required.';
        } elseif (mb_strlen($categoryName) > 255) {
            $errors[] = 'Category is too long (max 255 characters).';
        }

        if ($name === '') {
            $errors[] = 'Item Name is required.';
        } elseif (mb_strlen($name) > 150) {
            $errors[] = 'Item Name is too long (max 150 characters).';
        }

        $description = $this->text($cells['description'] ?? null);
        if (mb_strlen($description) > 500) {
            $errors[] = 'Description is too long (max 500 characters).';
        }

        $price = $this->parseMoney($cells['price'] ?? null, 'Price', $errors);

        $sizes = [];
        for ($i = 1; $i <= self::MAX_SIZES; $i++) {
            $sizeName = $this->text($cells["size_{$i}_name"] ?? null);
            $sizePrice = $this->parseMoney($cells["size_{$i}_price"] ?? null, "Size {$i} Price", $errors);

            if ($sizeName === '' && $sizePrice === null) {
                continue;
            }

            if ($sizeName === '' || $sizePrice === null) {
                $errors[] = "Size {$i} needs both a name and a price.";

                continue;
            }

            if (mb_strlen($sizeName) > 50) {
                $errors[] = "Size {$i} name is too long (max 50 characters).";
            }

            if (collect($sizes)->contains(fn ($s) => $this->key($s['name']) === $this->key($sizeName))) {
                $errors[] = "Size \"{$sizeName}\" is listed twice.";

                continue;
            }

            $sizes[] = ['name' => $sizeName, 'price' => $sizePrice, 'sort_order' => count($sizes)];
        }

        $available = $this->parseBool($cells['available'] ?? null, 'Available', $errors);
        $featured = $this->parseBool($cells['featured'] ?? null, 'Featured', $errors);
        $kitchen = $this->parseBool($cells['is_kitchen'] ?? null, 'Send to Kitchen', $errors);

        $sortOrder = null;
        $rawSort = $cells['sort_order'] ?? null;
        if ($rawSort !== null && trim((string) $rawSort) !== '') {
            if (is_numeric($rawSort) && (float) $rawSort >= 0 && (float) $rawSort == (int) $rawSort) {
                $sortOrder = (int) $rawSort;
            } else {
                $errors[] = 'Sort Order must be a whole number (0 or more).';
            }
        }

        $groupIds = null;
        $rawGroups = $this->text($cells['addon_groups'] ?? null);
        if ($rawGroups !== '') {
            $groupIds = [];
            foreach (preg_split('/[,;|\n]+/', $rawGroups) ?: [] as $groupName) {
                $groupName = trim($groupName);

                if ($groupName === '') {
                    continue;
                }

                $group = $this->addonGroups[$this->key($groupName)] ?? null;

                if ($group) {
                    $groupIds[] = $group->id;
                } else {
                    $errors[] = "Add-on group \"{$groupName}\" does not exist. Create it under Add-ons first, or check the spelling.";
                }
            }
        }

        $duplicateKey = $this->key($categoryName).'|'.$this->key($name);
        if ($categoryName !== '' && $name !== '') {
            if (isset($seen[$duplicateKey])) {
                $errors[] = "Duplicate of row {$seen[$duplicateKey]} in this file (same category and item name).";
            } else {
                $seen[$duplicateKey] = $row['row'];
            }
        }

        $existing = null;
        $existingCategory = $this->categories[$this->key($categoryName)] ?? null;
        if ($existingCategory && $name !== '') {
            $existing = MenuItem::where('category_id', $existingCategory->id)
                ->whereRaw('LOWER(name) = ?', [$this->key($name)])
                ->first();
        }

        if (! $existing && $sizes === [] && $price === null && $errors === []) {
            $errors[] = 'Enter a Price, or fill in at least one size (Size 1 Name + Price).';
        }

        $base = [
            'row' => $row['row'],
            'category' => $categoryName,
            'name' => $name,
            'new_category' => $categoryName !== '' && ! $existingCategory,
        ];

        if ($errors !== []) {
            return $base + ['status' => 'error', 'messages' => $errors];
        }

        if ($existing && $duplicateMode === self::MODE_SKIP) {
            return $base + ['status' => 'skipped', 'messages' => ['Already exists — skipped (choose "Update existing items" to change it).']];
        }

        $category = $existingCategory ?? $this->createCategory($categoryName, $this->text($cells['category_icon'] ?? null), $createdCategories);
        $itemPrice = $sizes !== [] ? min(array_column($sizes, 'price')) : $price;

        if ($existing) {
            $updates = array_filter([
                'description' => $description !== '' ? $description : null,
                'is_available' => $available,
                'is_featured' => $featured,
                'is_kitchen' => $kitchen,
                'sort_order' => $sortOrder,
            ], fn ($v) => $v !== null);

            if ($sizes !== []) {
                $updates['price'] = $itemPrice;
            } elseif ($price !== null) {
                if ($existing->variations()->exists()) {
                    $warnings[] = 'This item has sizes, so the Price was ignored. Fill in the Size columns to change size prices.';
                } else {
                    $updates['price'] = $price;
                }
            }

            $existing->update($updates);

            if ($sizes !== []) {
                $existing->variations()->delete();
                $existing->variations()->createMany($sizes);
            }

            if ($groupIds !== null) {
                $existing->addonGroups()->sync($groupIds);
            }

            return $base + ['status' => 'updated', 'messages' => $warnings];
        }

        $item = MenuItem::create([
            'category_id' => $category->id,
            'name' => $name,
            'description' => $description !== '' ? $description : null,
            'price' => $itemPrice,
            'is_available' => $available ?? true,
            'is_featured' => $featured ?? false,
            'is_kitchen' => $kitchen ?? true,
            'sort_order' => $sortOrder ?? 0,
        ]);

        if ($sizes !== []) {
            $item->variations()->createMany($sizes);
        }

        if ($groupIds) {
            $item->addonGroups()->sync($groupIds);
        }

        return $base + ['status' => 'created', 'messages' => []];
    }

    /**
     * @param  array<string, string>  $createdCategories
     */
    private function createCategory(string $name, string $icon, array &$createdCategories): Category
    {
        $category = Category::create([
            'name' => $name,
            'icon' => $icon !== '' ? mb_substr($icon, 0, 20) : self::DEFAULT_CATEGORY_ICON,
            'sort_order' => ((int) Category::max('sort_order')) + 1,
            'is_active' => true,
        ]);

        $this->categories[$this->key($name)] = $category;
        $createdCategories[$this->key($name)] = $name;

        return $category;
    }

    private function key(string $value): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/', ' ', $value) ?? $value));
    }

    private function text(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_float($value) && $value == (int) $value) {
            $value = (int) $value;
        }

        return trim(preg_replace('/\s+/u', ' ', (string) $value) ?? '');
    }

    /**
     * @param  list<string>  $errors
     */
    private function parseMoney(mixed $value, string $label, array &$errors): ?float
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        $clean = is_numeric($value) ? $value : preg_replace('/[^0-9.\-]/', '', str_replace(',', '', (string) $value));

        if (! is_numeric($clean) || (float) $clean < 0 || (float) $clean > self::MAX_PRICE) {
            $errors[] = "{$label} must be a number like 150 or 150.50 (got \"{$value}\").";

            return null;
        }

        return round((float) $clean, 2);
    }

    /**
     * @param  list<string>  $errors
     */
    private function parseBool(mixed $value, string $label, array &$errors): ?bool
    {
        $text = $this->key((string) ($value ?? ''));

        if ($text === '') {
            return null;
        }

        if (in_array($text, ['yes', 'y', 'true', '1', 'available', 'x', 'on'], true)) {
            return true;
        }

        if (in_array($text, ['no', 'n', 'false', '0', 'unavailable', 'off'], true)) {
            return false;
        }

        $errors[] = "{$label} must be Yes or No (got \"{$value}\").";

        return null;
    }
}
