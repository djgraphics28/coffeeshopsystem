<?php

use App\Models\AddonGroup;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;
use function Pest\Laravel\post;

const IMPORT_HEADERS = [
    'Category *', 'Item Name *', 'Description', 'Price', 'Size 1 Name', 'Size 1 Price', 'Size 2 Name', 'Size 2 Price',
    'Size 3 Name', 'Size 3 Price', 'Size 4 Name', 'Size 4 Price', 'Available', 'Featured', 'Send to Kitchen', 'Sort Order', 'Add-on Groups', 'Category Icon',
];

/**
 * Builds a row from named columns so tests stay readable (missing columns are left empty).
 *
 * @param  array<string, mixed>  $values  keyed by header without the "*" marker
 * @return list<mixed>
 */
function row(array $values): array
{
    return array_map(
        fn (string $header) => $values[trim(str_replace('*', '', $header))] ?? '',
        IMPORT_HEADERS,
    );
}

/**
 * Builds an upload from rows. CSV is used by default (light on memory); pass $xlsx to exercise real Excel files.
 *
 * @param  list<list<mixed>>  $rows
 * @param  list<string>  $headers
 */
function menuSpreadsheet(array $rows, array $headers = IMPORT_HEADERS, bool $xlsx = false): UploadedFile
{
    if (! $xlsx) {
        $path = tempnam(sys_get_temp_dir(), 'menu').'.csv';
        $handle = fopen($path, 'w');
        foreach ([$headers, ...$rows] as $line) {
            fputcsv($handle, $line);
        }
        fclose($handle);

        return new UploadedFile($path, 'menu.csv', 'text/csv', null, true);
    }

    $spreadsheet = new Spreadsheet;
    $spreadsheet->getActiveSheet()->setTitle('Menu Items')->fromArray([$headers, ...$rows], null, 'A1');

    $path = tempnam(sys_get_temp_dir(), 'menu').'.xlsx';
    IOFactory::createWriter($spreadsheet, 'Xlsx')->save($path);
    $spreadsheet->disconnectWorksheets();

    return new UploadedFile($path, 'menu.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
}

function importMenu(UploadedFile $file, string $mode = 'skip', bool $dryRun = false)
{
    return post(route('admin.menu-items.import'), [
        'file' => $file, 'duplicate_mode' => $mode, 'dry_run' => $dryRun ? 1 : 0,
    ], ['Accept' => 'application/json']);
}

describe('Menu item Excel import', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        actingAs($this->admin);
    });

    // Spreadsheet objects are heavy; release them so the whole suite stays within PHP's memory limit.
    afterEach(function () {
        gc_collect_cycles();
    });

    it('downloads a template with instructions, a data sheet, examples and reference', function () {
        $response = get(route('admin.menu-items.import.template'))->assertOk();

        $path = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
        file_put_contents($path, $response->streamedContent());
        $book = IOFactory::load($path);

        $names = $book->getSheetNames();
        $header = [$book->getSheetByName('Menu Items')->getCell('A1')->getValue(), $book->getSheetByName('Menu Items')->getCell('B1')->getValue(), $book->getSheetByName('Menu Items')->getCell('A2')->getValue()];
        $book->disconnectWorksheets();

        expect($names)->toBe(['Instructions', 'Menu Items', 'Examples', 'Reference'])
            ->and($header)->toBe(['Category *', 'Item Name *', null]);
    });

    it('lists existing categories and add-on groups on the reference sheet', function () {
        Category::factory()->create(['name' => 'Espresso']);
        AddonGroup::create(['name' => 'Milk Type', 'is_required' => false, 'max_selections' => 1, 'sort_order' => 1]);

        $path = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
        file_put_contents($path, get(route('admin.menu-items.import.template'))->streamedContent());
        $book = IOFactory::load($path);
        $reference = $book->getSheetByName('Reference');
        $values = [$reference->getCell('A2')->getValue(), $reference->getCell('C2')->getValue()];
        $book->disconnectWorksheets();

        expect($values)->toBe(['Espresso', 'Milk Type']);
    });

    it('creates items, auto-creates new categories, sizes and add-on links', function () {
        $existing = Category::factory()->create(['name' => 'Espresso']);
        $group = AddonGroup::create(['name' => 'Milk Type', 'is_required' => false, 'max_selections' => 1, 'sort_order' => 1]);

        $response = importMenu(menuSpreadsheet([
            row(['Category' => 'espresso', 'Item Name' => 'Latte', 'Description' => 'Smooth', 'Size 1 Name' => 'Small', 'Size 1 Price' => 120, 'Size 2 Name' => 'Large', 'Size 2 Price' => '150', 'Available' => 'Yes', 'Featured' => 'Yes', 'Sort Order' => 2, 'Add-on Groups' => 'milk type']),
            row(['Category' => 'Pastries', 'Item Name' => 'Croissant', 'Price' => '₱95.50', 'Category Icon' => '🥐']),
        ], IMPORT_HEADERS, true))->assertOk();

        $response->assertJsonPath('summary.created', 2)
            ->assertJsonPath('summary.failed', 0)
            ->assertJsonPath('summary.categories_created.0', 'Pastries');

        $latte = MenuItem::firstWhere('name', 'Latte');
        expect($latte->category_id)->toBe($existing->id)
            ->and($latte->variations)->toHaveCount(2)
            ->and($latte->price)->toBe(120.0)
            ->and($latte->is_featured)->toBeTrue()
            ->and($latte->addonGroups->pluck('id')->all())->toBe([$group->id]);

        $pastries = Category::firstWhere('name', 'Pastries');
        expect($pastries->icon)->toBe('🥐')
            ->and(MenuItem::firstWhere('name', 'Croissant')->price)->toBe(95.5)
            ->and(Category::where('name', 'like', 'espresso')->count())->toBe(1);
    });

    it('previews without saving anything on a dry run', function () {
        importMenu(menuSpreadsheet([row(['Category' => 'Brand New', 'Item Name' => 'Mocha', 'Price' => 130])]), 'skip', true)
            ->assertOk()
            ->assertJsonPath('summary.created', 1)
            ->assertJsonPath('summary.dry_run', true)
            ->assertJsonPath('summary.categories_created.0', 'Brand New');

        expect(MenuItem::where('name', 'Mocha')->exists())->toBeFalse()
            ->and(Category::where('name', 'Brand New')->exists())->toBeFalse();
    });

    it('skips existing items by default and updates them when asked', function () {
        $category = Category::factory()->create(['name' => 'Espresso']);
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'name' => 'Latte', 'price' => 100, 'description' => 'Keep me']);

        $file = fn () => menuSpreadsheet([row(['Category' => 'Espresso', 'Item Name' => 'LATTE', 'Price' => 175])]);

        importMenu($file(), 'skip')->assertJsonPath('summary.skipped', 1);
        expect($item->fresh()->price)->toBe(100.0);

        importMenu($file(), 'update')->assertJsonPath('summary.updated', 1);
        expect($item->fresh()->price)->toBe(175.0)
            ->and($item->fresh()->description)->toBe('Keep me')
            ->and(MenuItem::where('category_id', $category->id)->count())->toBe(1);
    });

    it('reports a clear message per bad row and still imports the good rows', function () {
        $response = importMenu(menuSpreadsheet([
            row(['Category' => 'Drinks', 'Item Name' => 'Good Item', 'Price' => 100]),
            row(['Category' => '', 'Item Name' => 'No Category', 'Price' => 90]),
            row(['Category' => 'Drinks', 'Item Name' => 'Bad Price', 'Price' => 'abc']),
            row(['Category' => 'Drinks', 'Item Name' => 'Half Size', 'Size 1 Name' => 'Small']),
            row(['Category' => 'Drinks', 'Item Name' => 'No Price']),
            row(['Category' => 'Drinks', 'Item Name' => 'Bad Flag', 'Price' => 50, 'Available' => 'Maybe']),
            row(['Category' => 'Drinks', 'Item Name' => 'Unknown Add-on', 'Price' => 50, 'Add-on Groups' => 'Ghost Group']),
            row(['Category' => 'Drinks', 'Item Name' => 'Good Item', 'Price' => 100]),
            row(['Category' => 'Drinks', 'Item Name' => 'Bad Kitchen', 'Price' => 50, 'Send to Kitchen' => 'Sometimes']),
        ]))->assertOk();

        $response->assertJsonPath('summary.created', 1)->assertJsonPath('summary.failed', 8);

        $rows = collect($response->json('rows'))->keyBy('row');
        expect($rows[3]['messages'][0])->toContain('Category is required')
            ->and($rows[4]['messages'][0])->toContain('Price must be a number')
            ->and($rows[5]['messages'][0])->toContain('Size 1 needs both')
            ->and($rows[6]['messages'][0])->toContain('Enter a Price')
            ->and($rows[7]['messages'][0])->toContain('Yes or No')
            ->and($rows[8]['messages'][0])->toContain('Ghost Group')
            ->and($rows[9]['messages'][0])->toContain('Duplicate of row 2')
            ->and($rows[10]['messages'][0])->toContain('Send to Kitchen must be Yes or No');

        expect(MenuItem::count())->toBe(1);
    });

    it('sets Send to Kitchen on import and defaults to Yes when empty', function () {
        importMenu(menuSpreadsheet([
            row(['Category' => 'Drinks', 'Item Name' => 'Cooked Soup', 'Price' => 100]),
            row(['Category' => 'Drinks', 'Item Name' => 'Iced Latte', 'Price' => 25, 'Send to Kitchen' => 'No']),
            row(['Category' => 'Drinks', 'Item Name' => 'Pasta', 'Price' => 180, 'Send to Kitchen' => 'yes']),
        ]))->assertJsonPath('summary.created', 3);

        expect(MenuItem::firstWhere('name', 'Cooked Soup')->is_kitchen)->toBeTrue()
            ->and(MenuItem::firstWhere('name', 'Iced Latte')->is_kitchen)->toBeFalse()
            ->and(MenuItem::firstWhere('name', 'Pasta')->is_kitchen)->toBeTrue();
    });

    it('only changes Send to Kitchen on update when the cell is filled', function () {
        $category = Category::factory()->create(['name' => 'Drinks']);
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'name' => 'Tea', 'price' => 50, 'is_kitchen' => false]);

        importMenu(menuSpreadsheet([row(['Category' => 'Drinks', 'Item Name' => 'Tea', 'Price' => 60])]), 'update');
        expect($item->fresh()->is_kitchen)->toBeFalse()->and($item->fresh()->price)->toBe(60.0);

        importMenu(menuSpreadsheet([row(['Category' => 'Drinks', 'Item Name' => 'Tea', 'Send to Kitchen' => 'Yes'])]), 'update');
        expect($item->fresh()->is_kitchen)->toBeTrue();
    });

    it('does not create a category for a row that fails validation', function () {
        importMenu(menuSpreadsheet([row(['Category' => 'Ghost Category', 'Item Name' => 'Broken', 'Price' => 'abc'])]))->assertJsonPath('summary.failed', 1);

        expect(Category::where('name', 'Ghost Category')->exists())->toBeFalse();
    });

    it('rejects a file without the required header columns', function () {
        importMenu(menuSpreadsheet([['x', 'y']], ['Foo', 'Bar']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    });

    it('rejects an empty sheet and non-spreadsheet uploads', function () {
        importMenu(menuSpreadsheet([]))->assertStatus(422)->assertJsonValidationErrors('file');

        post(route('admin.menu-items.import'), [
            'file' => UploadedFile::fake()->create('menu.pdf', 10, 'application/pdf'), 'duplicate_mode' => 'skip',
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('file');
    });

    it('forbids users without the manage menu items permission', function () {
        $kitchen = User::factory()->create();
        $kitchen->assignRole('kitchen');

        actingAs($kitchen);
        get(route('admin.menu-items.import.template'))->assertForbidden();
        importMenu(menuSpreadsheet([row(['Category' => 'A', 'Item Name' => 'B', 'Price' => 1])]))->assertForbidden();
    });
});
