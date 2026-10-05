<?php

namespace App\Actions\MenuItems;

use App\Models\AddonGroup;
use App\Models\Category;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Builds the downloadable Excel template: Instructions, the sheet to fill in, worked examples,
 * and a reference list of the categories / add-on groups that already exist.
 */
class BuildMenuItemImportTemplate
{
    private const BROWN = '2C1A0E';

    private const REQUIRED_FILL = 'C0392B';

    private const OPTIONAL_FILL = '5B6B7F';

    private const LAST_ROW = 1001;

    /** @var list<array{header: string, required: bool, width: int, what: string, example: string}> */
    private const COLUMNS = [
        ['header' => 'Category', 'required' => true, 'width' => 22, 'what' => 'The menu section the item belongs to. Pick one from the dropdown, or type a NEW name — it is created automatically.', 'example' => 'Cold Brews'],
        ['header' => 'Item Name', 'required' => true, 'width' => 30, 'what' => 'The name customers see. Max 150 characters.', 'example' => 'Iced Americano'],
        ['header' => 'Description', 'required' => false, 'width' => 40, 'what' => 'Short text shown on the menu. Max 500 characters.', 'example' => 'Double espresso over ice'],
        ['header' => 'Price', 'required' => false, 'width' => 12, 'what' => 'Selling price as a plain number (150 or 150.50, no currency symbol). Required UNLESS you fill in sizes.', 'example' => '140'],
        ['header' => 'Size 1 Name', 'required' => false, 'width' => 14, 'what' => 'Only for items sold in sizes. E.g. Small. If you use sizes, leave Price empty.', 'example' => 'Small'],
        ['header' => 'Size 1 Price', 'required' => false, 'width' => 13, 'what' => 'Price of Size 1. A size needs BOTH its name and its price.', 'example' => '120'],
        ['header' => 'Size 2 Name', 'required' => false, 'width' => 14, 'what' => 'Second size (optional), e.g. Medium.', 'example' => 'Medium'],
        ['header' => 'Size 2 Price', 'required' => false, 'width' => 13, 'what' => 'Price of Size 2.', 'example' => '140'],
        ['header' => 'Size 3 Name', 'required' => false, 'width' => 14, 'what' => 'Third size (optional), e.g. Large.', 'example' => 'Large'],
        ['header' => 'Size 3 Price', 'required' => false, 'width' => 13, 'what' => 'Price of Size 3.', 'example' => '160'],
        ['header' => 'Size 4 Name', 'required' => false, 'width' => 14, 'what' => 'Fourth size (optional).', 'example' => ''],
        ['header' => 'Size 4 Price', 'required' => false, 'width' => 13, 'what' => 'Price of Size 4.', 'example' => ''],
        ['header' => 'Available', 'required' => false, 'width' => 12, 'what' => 'Yes = can be ordered, No = hidden from ordering. Empty = Yes.', 'example' => 'Yes'],
        ['header' => 'Featured', 'required' => false, 'width' => 12, 'what' => 'Yes = highlighted as a featured item. Empty = No.', 'example' => 'No'],
        ['header' => 'Send to Kitchen', 'required' => false, 'width' => 16, 'what' => 'Which station prepares it. Yes = the Kitchen (cooked food). No = the Barista (drinks and anything not cooked in the kitchen). Empty = Yes.', 'example' => 'Yes'],
        ['header' => 'Sort Order', 'required' => false, 'width' => 12, 'what' => 'Whole number; smaller numbers appear first. Empty = 0.', 'example' => '1'],
        ['header' => 'Add-on Groups', 'required' => false, 'width' => 30, 'what' => 'Names of EXISTING add-on groups, separated by commas (see the Reference sheet). Unknown names are reported as errors.', 'example' => 'Milk Type, Extras'],
        ['header' => 'Category Icon', 'required' => false, 'width' => 14, 'what' => 'An emoji, used ONLY when this row creates a new category (default 🍽️).', 'example' => '🧊'],
    ];

    /** @var list<list<string|int>> */
    private const EXAMPLES = [
        ['Cold Brews', 'Iced Americano', 'Double espresso over ice', '', 'Small', 120, 'Medium', 140, 'Large', 160, '', '', 'Yes', 'Yes', 'No', 1, 'Milk Type, Extras', '🧊'],
        ['Cold Brews', 'Cold Brew Tonic', 'Cold brew with tonic water', 150, '', '', '', '', '', '', '', '', 'Yes', 'No', 'No', 2, '', ''],
        ['Pastries', 'Butter Croissant', 'Flaky and freshly baked', 95, '', '', '', '', '', '', '', '', 'Yes', 'No', 'Yes', '', '', '🥐'],
        ['Hot Meals', 'Pasta Carbonara', 'Creamy and cooked to order', 220, '', '', '', '', '', '', '', '', 'Yes', 'No', 'Yes', '', '', '🍝'],
        ['Hot Meals', 'Seasonal Soup', 'Sold out for now', 130, '', '', '', '', '', '', '', '', 'No', 'No', 'Yes', '', '', ''],
    ];

    public function handle(): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $spreadsheet->getProperties()->setTitle('Menu Items Import Template')->setCreator(config('app.name'));

        $this->buildInstructions($spreadsheet->getActiveSheet());
        $dataSheet = $spreadsheet->createSheet();
        $examples = $spreadsheet->createSheet();
        $reference = $spreadsheet->createSheet();

        $this->buildReference($reference);
        $this->buildDataSheet($dataSheet, $reference);
        $this->buildExamples($examples);

        $spreadsheet->setActiveSheetIndex(1);

        return $spreadsheet;
    }

    private function buildInstructions(Worksheet $sheet): void
    {
        $sheet->setTitle('Instructions');
        $sheet->setShowGridlines(false);
        $sheet->getColumnDimension('A')->setWidth(3);
        $sheet->getColumnDimension('B')->setWidth(22);
        $sheet->getColumnDimension('C')->setWidth(12);
        $sheet->getColumnDimension('D')->setWidth(78);
        $sheet->getColumnDimension('E')->setWidth(22);

        $sheet->setCellValue('B2', 'Menu Items — Import Template');
        $sheet->getStyle('B2')->getFont()->setBold(true)->setSize(18)->getColor()->setRGB(self::BROWN);

        $sheet->setCellValue('B3', 'Add many menu items at once. Follow the steps below — it takes about two minutes.');
        $sheet->getStyle('B3')->getFont()->setItalic(true)->getColor()->setRGB('666666');

        $steps = [
            'HOW TO USE',
            '1.  Open the "Menu Items" sheet (the next tab). Do NOT change or delete the header row (row 1).',
            '2.  Type ONE menu item per row, starting at row 2. Columns marked with * are required.',
            '3.  Look at the "Examples" sheet to see correctly filled rows. Examples are NOT imported — copy what you need.',
            '4.  Save the file as .xlsx (or .csv) and upload it on the Menu Items page → Import. You will see a preview and can fix problems before anything is saved.',
        ];
        $row = 5;
        foreach ($steps as $i => $line) {
            $sheet->setCellValue("B{$row}", $line);
            $sheet->mergeCells("B{$row}:E{$row}");
            if ($i === 0) {
                $this->sectionTitle($sheet, "B{$row}:E{$row}");
            } else {
                $sheet->getStyle("B{$row}")->getAlignment()->setWrapText(true);
                $sheet->getRowDimension($row)->setRowHeight(30);
            }
            $row++;
        }

        $row++;
        $sheet->setCellValue("B{$row}", 'IMPORTANT RULES');
        $sheet->mergeCells("B{$row}:E{$row}");
        $this->sectionTitle($sheet, "B{$row}:E{$row}");
        $row++;

        $rules = [
            'New categories are created for you. If the Category you type does not exist yet, it is added automatically (new categories use the optional "Category Icon", otherwise 🍽️). Spelling/capitalisation differences like "cold brews" vs "Cold Brews" are treated as the same category.',
            'Items with sizes: fill Size 1 Name + Size 1 Price (up to 4 sizes) and leave Price empty. The lowest size price becomes the "From" price. Items without sizes: just fill Price.',
            'Items that already exist (same Category + same Item Name) are SKIPPED by default. On the upload screen you can choose "Update existing items" to change them instead. When updating, empty cells keep the current value.',
            'Rows with problems are not imported — you get a clear message per row (e.g. "Row 7: Price must be a number") so you can fix and re-upload. Good rows are never blocked by bad ones.',
            'Send to Kitchen: Yes = the item is queued on the Kitchen screen (cooked food). No = it goes to the Barista screen instead (coffee, drinks, anything not cooked in the kitchen). An order with both kinds of items shows up on both screens. Leave empty to use Yes.',
            'Add-on groups must already exist (create them under Add-ons first). Use the exact names listed on the "Reference" sheet, separated by commas.',
            'Images cannot be imported — add pictures afterwards by editing each item.',
            'Limits: up to 1,000 items per file, 5 MB.',
        ];
        foreach ($rules as $rule) {
            $sheet->setCellValue("B{$row}", '•  '.$rule);
            $sheet->mergeCells("B{$row}:E{$row}");
            $sheet->getStyle("B{$row}")->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_TOP);
            $sheet->getRowDimension($row)->setRowHeight(strlen($rule) > 190 ? 48 : 32);
            $row++;
        }

        $row++;
        $sheet->setCellValue("B{$row}", 'COLUMN GUIDE');
        $sheet->mergeCells("B{$row}:E{$row}");
        $this->sectionTitle($sheet, "B{$row}:E{$row}");
        $row++;

        foreach (['Column', 'Required?', 'What to enter', 'Example'] as $i => $header) {
            $cell = chr(ord('B') + $i).$row;
            $sheet->setCellValue($cell, $header);
            $sheet->getStyle($cell)->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
            $sheet->getStyle($cell)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB(self::BROWN);
        }
        $row++;

        foreach (self::COLUMNS as $column) {
            $sheet->setCellValue("B{$row}", $column['header']);
            $sheet->setCellValue("C{$row}", $column['required'] ? 'Yes *' : 'Optional');
            $sheet->setCellValue("D{$row}", $column['what']);
            $sheet->setCellValueExplicit("E{$row}", (string) $column['example'], DataType::TYPE_STRING);
            $sheet->getStyle("B{$row}")->getFont()->setBold(true);
            if ($column['required']) {
                $sheet->getStyle("C{$row}")->getFont()->setBold(true)->getColor()->setRGB(self::REQUIRED_FILL);
            }
            $sheet->getStyle("B{$row}:E{$row}")->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_TOP);
            $sheet->getStyle("B{$row}:E{$row}")->getBorders()->getBottom()->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('E4E7EC');
            $sheet->getRowDimension($row)->setRowHeight(strlen($column['what']) > 85 ? 34 : 20);
            $row++;
        }
    }

    private function sectionTitle(Worksheet $sheet, string $range): void
    {
        $style = $sheet->getStyle($range);
        $style->getFont()->setBold(true)->setSize(12)->getColor()->setRGB('FFFFFF');
        $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB(self::BROWN);
        $style->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getRowDimension((int) preg_replace('/\D/', '', explode(':', $range)[0]))->setRowHeight(22);
    }

    private function buildReference(Worksheet $sheet): void
    {
        $sheet->setTitle('Reference');
        $sheet->setCellValue('A1', 'Existing Categories');
        $sheet->setCellValue('C1', 'Existing Add-on Groups');
        $sheet->setCellValue('E1', 'Allowed Yes / No values');
        foreach (['A1', 'C1', 'E1'] as $cell) {
            $sheet->getStyle($cell)->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
            $sheet->getStyle($cell)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB(self::BROWN);
        }

        foreach (Category::orderBy('sort_order')->orderBy('name')->pluck('name')->values() as $i => $name) {
            $sheet->setCellValueExplicit('A'.($i + 2), (string) $name, DataType::TYPE_STRING);
        }

        foreach (AddonGroup::orderBy('sort_order')->orderBy('name')->pluck('name')->values() as $i => $name) {
            $sheet->setCellValueExplicit('C'.($i + 2), (string) $name, DataType::TYPE_STRING);
        }

        $sheet->setCellValue('E2', 'Yes');
        $sheet->setCellValue('E3', 'No');
        $sheet->setCellValue('G1', 'This sheet is for reference only and is not imported. It lists what already exists in your system when the template was downloaded.');
        $sheet->getStyle('G1')->getFont()->setItalic(true)->getColor()->setRGB('666666');

        foreach (['A' => 30, 'B' => 3, 'C' => 30, 'D' => 3, 'E' => 24] as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
    }

    private function buildDataSheet(Worksheet $sheet, Worksheet $reference): void
    {
        $sheet->setTitle('Menu Items');
        $this->writeHeader($sheet);

        $categoryCount = max(Category::count(), 1) + 1;

        foreach (['M', 'N', 'O'] as $col) {
            $this->listValidation($sheet, $col, '=Reference!$E$2:$E$3', true);
        }

        $this->listValidation($sheet, 'A', "=Reference!\$A\$2:\$A\${$categoryCount}", false);
        $this->numberValidation($sheet, ['D', 'F', 'H', 'J', 'L'], DataValidation::TYPE_DECIMAL, 'Enter a number such as 150 or 150.50 (no currency symbol).');
        $this->numberValidation($sheet, ['P'], DataValidation::TYPE_WHOLE, 'Enter a whole number, 0 or more.');

        $sheet->getStyle('A2:R'.self::LAST_ROW)->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getStyle('A2:R'.self::LAST_ROW)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_HAIR)->getColor()->setRGB('CCCCCC');
        $sheet->getStyle('C2:C'.self::LAST_ROW)->getNumberFormat()->setFormatCode('@');
    }

    private function buildExamples(Worksheet $sheet): void
    {
        $sheet->setTitle('Examples');
        $this->writeHeader($sheet);

        foreach (self::EXAMPLES as $r => $values) {
            foreach ($values as $c => $value) {
                if ($value === '') {
                    continue;
                }

                $sheet->setCellValueExplicit([$c + 1, $r + 2], $value, is_int($value) ? DataType::TYPE_NUMERIC : DataType::TYPE_STRING);
            }
        }

        $sheet->setCellValue('S1', 'EXAMPLES ONLY — these rows are NOT imported. Copy what you need into the "Menu Items" sheet.');
        $sheet->getStyle('S1')->getFont()->setBold(true)->getColor()->setRGB(self::REQUIRED_FILL);
        $sheet->getStyle('A2:R'.(count(self::EXAMPLES) + 1))->getFont()->setItalic(true)->getColor()->setRGB('555555');
        $sheet->getStyle('A2:R'.(count(self::EXAMPLES) + 1))->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F6F4EF');
    }

    private function writeHeader(Worksheet $sheet): void
    {
        foreach (self::COLUMNS as $i => $column) {
            $letter = chr(ord('A') + $i);
            $sheet->setCellValue("{$letter}1", $column['header'].($column['required'] ? ' *' : ''));
            $sheet->getColumnDimension($letter)->setWidth($column['width']);
            $sheet->getStyle("{$letter}1")->getFill()->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setRGB($column['required'] ? self::REQUIRED_FILL : self::OPTIONAL_FILL);
        }

        $header = $sheet->getStyle('A1:R1');
        $header->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $header->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER)->setWrapText(true);
        $sheet->getRowDimension(1)->setRowHeight(30);
        $sheet->freezePane('C2');
    }

    private function listValidation(Worksheet $sheet, string $column, string $formula, bool $strict): void
    {
        $validation = new DataValidation;
        $validation->setType(DataValidation::TYPE_LIST);
        $validation->setAllowBlank(true);
        $validation->setShowDropDown(false);
        $validation->setShowErrorMessage(true);
        $validation->setErrorStyle($strict ? DataValidation::STYLE_STOP : DataValidation::STYLE_INFORMATION);
        $validation->setErrorTitle($strict ? 'Choose Yes or No' : 'New category');
        $validation->setError($strict ? 'Please pick Yes or No from the list.' : 'This category does not exist yet — it will be created automatically on import.');
        $validation->setFormula1($formula);

        $this->applyValidation($sheet, $column, $validation);
    }

    /**
     * @param  list<string>  $columns
     */
    private function numberValidation(Worksheet $sheet, array $columns, string $type, string $message): void
    {
        foreach ($columns as $column) {
            $validation = new DataValidation;
            $validation->setType($type);
            $validation->setOperator(DataValidation::OPERATOR_GREATERTHANOREQUAL);
            $validation->setAllowBlank(true);
            $validation->setShowErrorMessage(true);
            $validation->setErrorStyle(DataValidation::STYLE_STOP);
            $validation->setErrorTitle('Invalid number');
            $validation->setError($message);
            $validation->setFormula1('0');

            $this->applyValidation($sheet, $column, $validation);
        }
    }

    private function applyValidation(Worksheet $sheet, string $column, DataValidation $validation): void
    {
        $sheet->setDataValidation("{$column}2:{$column}".self::LAST_ROW, $validation);
    }
}
