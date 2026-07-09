<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Http;

class Recaptcha implements ValidationRule
{
    /**
     * Verify a Google reCAPTCHA v3 token against the siteverify API.
     * Skipped entirely when no secret key is configured (e.g. local dev).
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $secret = config('services.recaptcha.secret_key');

        if (empty($secret)) {
            return;
        }

        $response = Http::asForm()->post('https://www.google.com/recaptcha/api/siteverify', [
            'secret' => $secret,
            'response' => $value,
            'remoteip' => request()->ip(),
        ]);

        $result = $response->json();

        if (! $response->successful() || ! ($result['success'] ?? false)) {
            $fail('CAPTCHA verification failed. Please try again.');

            return;
        }

        $minScore = (float) config('services.recaptcha.min_score', 0.5);

        if (isset($result['score']) && $result['score'] < $minScore) {
            $fail('CAPTCHA verification failed. Please try again.');
        }
    }

    public static function isConfigured(): bool
    {
        return ! empty(config('services.recaptcha.site_key'))
            && ! empty(config('services.recaptcha.secret_key'));
    }
}
