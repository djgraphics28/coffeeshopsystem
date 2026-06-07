<?php

use App\Events\OrderPlaced;
use App\Events\OrderStatusUpdated;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

it('broadcasts order placed immediately without a queue', function () {
    expect(class_implements(OrderPlaced::class))
        ->toContain(ShouldBroadcastNow::class);
});

it('broadcasts order status updates immediately without a queue', function () {
    expect(class_implements(OrderStatusUpdated::class))
        ->toContain(ShouldBroadcastNow::class);
});
