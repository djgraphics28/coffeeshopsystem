<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            // true = prepared in the kitchen and queued in the kitchen module; false = ready-made / no cooking.
            $table->boolean('is_kitchen')->default(true)->after('is_featured');
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropColumn('is_kitchen');
        });
    }
};
