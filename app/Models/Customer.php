<?php

namespace App\Models;

use App\Notifications\CustomerVerifyEmail;
use Database\Factories\CustomerFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class Customer extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory, Notifiable;

    /** @var list<string> */
    protected $fillable = ['name', 'phone', 'email', 'notes', 'password', 'points', 'cup_count', 'free_drinks_available'];

    /** @var list<string> */
    protected $hidden = ['password', 'remember_token'];

    /** @var array<string, string> */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'points' => 'integer',
        'cup_count' => 'integer',
        'free_drinks_available' => 'integer',
    ];

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new CustomerVerifyEmail);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function promoUsages(): HasMany
    {
        return $this->hasMany(PromoUsage::class);
    }
}
