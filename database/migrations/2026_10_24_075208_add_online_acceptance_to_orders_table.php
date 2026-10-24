<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Online (storefront) orders are kept apart from POS orders and must be
     * accepted by the café before the kitchen / barista start on them.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('source', 20)->default('pos')->after('type')->index();
            $table->timestamp('accepted_at')->nullable()->after('status');
            $table->foreignId('accepted_by')->nullable()->after('accepted_at')->constrained('users')->nullOnDelete();
            $table->string('decline_reason')->nullable()->after('accepted_by');
            $table->timestamp('reminded_at')->nullable()->after('decline_reason');
        });

        // Earlier storefront orders: placed by a customer, not by a staff member at the POS.
        // They were already worked on, so treat them as accepted.
        DB::table('orders')
            ->whereNull('created_by')
            ->whereNotNull('customer_id')
            ->update(['source' => 'online', 'accepted_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('accepted_by');
            $table->dropColumn(['source', 'accepted_at', 'decline_reason', 'reminded_at']);
        });
    }
};
