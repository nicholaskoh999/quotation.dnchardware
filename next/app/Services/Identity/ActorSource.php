<?php

namespace App\Services\Identity;

/**
 * Where an authenticated identity came from. The two id spaces never mix:
 * an `app_users.id` is an Actor id; a canonical DNC `users.id` is only ever a
 * dncUserId (legacy dc_current_user(): source 'dnc', id NULL).
 */
enum ActorSource: string
{
    /** Password sign-in against the legacy QUOTATION `app_users` table. */
    case AppUsers = 'app_users';

    /** DNC Workspace handoff (contract v2) — a canonical Internal PO `users` row. */
    case Dnc = 'dnc';
}
