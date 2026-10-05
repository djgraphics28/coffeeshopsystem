<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 40)->unique();
            $table->string('frequency', 20);
            $table->date('period_start');
            $table->date('period_end');
            $table->date('pay_date')->nullable();
            $table->string('status', 20)->default('draft');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->unique(['frequency', 'period_start', 'period_end']);
        });

        Schema::create('payslips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payroll_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();

            // Snapshot of who they were and how they were paid, so old payslips never change.
            $table->string('employee_name');
            $table->string('employee_code', 20);
            $table->string('position')->nullable();
            $table->string('salary_type', 20);
            $table->decimal('base_salary', 10, 2);
            $table->decimal('daily_rate', 10, 2);
            $table->decimal('hourly_rate', 10, 4);

            $table->decimal('days_worked', 6, 2)->default(0);
            $table->decimal('expected_days', 6, 2)->default(0);
            $table->decimal('absent_days', 6, 2)->default(0);
            $table->unsignedInteger('worked_minutes')->default(0);
            $table->unsignedInteger('late_minutes')->default(0);
            $table->unsignedInteger('overtime_minutes')->default(0);
            $table->unsignedInteger('incomplete_days')->default(0);

            $table->decimal('basic_pay', 12, 2)->default(0);
            $table->decimal('overtime_pay', 12, 2)->default(0);
            $table->decimal('earnings', 12, 2)->default(0);
            $table->decimal('late_deduction', 12, 2)->default(0);
            $table->decimal('absence_deduction', 12, 2)->default(0);
            $table->decimal('other_deductions', 12, 2)->default(0);
            $table->decimal('gross_pay', 12, 2)->default(0);
            $table->decimal('total_deductions', 12, 2)->default(0);
            $table->decimal('net_pay', 12, 2)->default(0);
            $table->timestamps();

            $table->unique(['payroll_run_id', 'employee_id']);
        });

        Schema::create('payslip_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payslip_id')->constrained()->cascadeOnDelete();
            $table->string('type', 10); // earning | deduction
            $table->string('label', 100);
            $table->decimal('amount', 12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payslip_adjustments');
        Schema::dropIfExists('payslips');
        Schema::dropIfExists('payroll_runs');
    }
};
