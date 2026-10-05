<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayslipAdjustment extends Model
{
    protected $fillable = ['payslip_id', 'type', 'label', 'amount'];

    protected $casts = ['amount' => 'float'];

    public function payslip(): BelongsTo
    {
        return $this->belongsTo(Payslip::class);
    }
}
