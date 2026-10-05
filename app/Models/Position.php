<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Position extends Model
{
    protected $fillable = ['name', 'description', 'is_driver', 'system_role', 'is_active'];

    protected $casts = [
        'is_driver' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function scopeActive($query): void
    {
        $query->where('is_active', true)->orderBy('name');
    }
}
