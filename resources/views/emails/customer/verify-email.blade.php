<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>Verify Your Email — Milk&amp;Honey Cafe</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #F5EDD8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; }
        a { color: inherit; text-decoration: none; }
    </style>
</head>
<body style="background-color: #F5EDD8; padding: 40px 16px;">

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
            <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E5D9C4;">

                    {{-- Header --}}
                    <tr>
                        <td style="background-color: #2C1A0E; padding: 24px 32px;">
                            <table cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td style="vertical-align: middle; padding-right: 14px;">
                                        <table cellpadding="0" cellspacing="0" border="0" style="width: 40px; height: 40px; background-color: #D4A843; border-radius: 10px;">
                                            <tr>
                                                <td align="center" valign="middle" style="font-size: 20px; line-height: 1;">&#9749;</td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <p style="color: #D4A843; font-size: 13px; font-weight: 600; margin: 0; letter-spacing: 0.06em; text-transform: uppercase;">Milk&amp;Honey Cafe</p>
                                        <p style="color: rgba(255,255,255,0.45); font-size: 11px; margin: 3px 0 0;">no-reply@milkandhoneycafe.com</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {{-- Body --}}
                    <tr>
                        <td style="padding: 36px 32px 28px;">

                            {{-- Subject line --}}
                            <p style="font-size: 13px; color: #9CA3AF; margin: 0 0 6px;">Subject</p>
                            <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 24px; padding-bottom: 20px; border-bottom: 1px solid #F3F4F6;">
                                Verify Your Email &mdash; Milk&amp;Honey Cafe
                            </p>

                            {{-- Greeting --}}
                            <p style="font-size: 15px; color: #111827; margin: 0 0 10px;">
                                Hello, <strong>{{ $notifiable->name }}</strong>!
                            </p>
                            <p style="font-size: 14px; color: #6B7280; line-height: 1.65; margin: 0 0 28px;">
                                Thanks for signing up! Please verify your email address to start ordering from Milk&amp;Honey Cafe.
                            </p>

                            {{-- CTA Button --}}
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
                                <tr>
                                    <td align="center">
                                        <a href="{{ $verifyUrl }}"
                                           style="display: inline-block; background-color: #D4A843; color: #2C1A0E; font-size: 14px; font-weight: 600; text-decoration: none; padding: 13px 36px; border-radius: 100px; letter-spacing: 0.01em;">
                                            Verify Email Address
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            {{-- Fallback URL --}}
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="background-color: #F9F5ED; border-radius: 8px; padding: 14px 16px;">
                                        <p style="font-size: 11px; color: #6B7280; margin: 0 0 5px; font-weight: 500;">Or paste this link in your browser</p>
                                        <p style="font-size: 11px; color: #9CA3AF; margin: 0; word-break: break-all; font-family: 'Courier New', Courier, monospace;">{{ $verifyUrl }}</p>
                                    </td>
                                </tr>
                            </table>

                            {{-- Footer notes --}}
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top: 1px solid #F3F4F6; padding-top: 20px;">
                                <tr>
                                    <td>
                                        <p style="font-size: 12px; color: #9CA3AF; margin: 0 0 6px;">
                                            &#x23F0; This link expires in <strong style="color: #6B7280;">60 minutes</strong>.
                                        </p>
                                        <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
                                            If you did not create an account, no action is needed.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    {{-- Footer --}}
                    <tr>
                        <td style="background-color: #FAF7F0; padding: 16px 32px; border-top: 1px solid #F3F4F6; text-align: center;">
                            <p style="font-size: 11px; color: #9CA3AF; margin: 0;">
                                Milk&amp;Honey Cafe &middot; Your favorite neighborhood brew
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
