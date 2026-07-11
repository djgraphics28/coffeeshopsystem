<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('delivery_men', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->unique()->after('is_active')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('delivery_men', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
