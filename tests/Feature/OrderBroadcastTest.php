<?php

use App\Events\OrderPlaced;
use App\Events\OrderStatusUpdated;
use App\Models\Setting;
use App\Providers\AppServiceProvider;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

it('broadcasts order placed immediately without a queue', function () {
    expect(class_implements(OrderPlaced::class))
        ->toContain(ShouldBroadcastNow::class);
});

it('broadcasts order status updates immediately without a queue', function () {
    expect(class_implements(OrderStatusUpdated::class))
        ->toContain(ShouldBroadcastNow::class);
});

it('uses the pusher connection when credentials are saved in settings', function () {
    foreach (['pusher_app_id' => '1', 'pusher_app_key' => 'key', 'pusher_app_secret' => 'secret', 'pusher_app_cluster' => 'ap1'] as $k => $v) {
        Setting::set($k, $v);
    }

    (new AppServiceProvider(app()))->boot();

    expect(config('broadcasting.default'))->toBe('pusher')
        ->and(config('broadcasting.connections.pusher.key'))->toBe('key');
});
