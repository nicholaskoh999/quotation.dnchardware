<?php

use App\Http\Controllers\Auth\HandoffController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\Read\CompanyController;
use App\Http\Controllers\Read\QuotationController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
 * PUBLIC — and nothing else is. Every application page goes in the `auth`
 * group below; tests/Feature/Auth/RouteProtectionTest.php fails if a route
 * outside this short list is reachable without signing in.
 */
Route::get('/health', HealthController::class)->name('health');

Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->name('login.store');
});

// Not behind `auth`: signing out must always clear this browser's session.
Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');

// DNC Workspace handoff, contract v2 — 404 unless DNC_HANDOFF_ENABLED=true.
Route::get('/auth/handoff/start', [HandoffController::class, 'start'])->name('handoff.start');
Route::get('/auth/handoff/callback', [HandoffController::class, 'callback'])->name('handoff.callback');

/*
 * SIGNED-IN — every application page (home, quotations, companies, …).
 */
Route::middleware('auth')->group(function () {
    Route::get('/', fn () => Inertia::render('Home'))->name('home');

    /* Wave 1 · Session D — legacy data, READ ONLY. GET routes only. */
    Route::get('/companies', [CompanyController::class, 'index'])->name('companies.index');
    Route::get('/companies/{id}', [CompanyController::class, 'show'])->where('id', '[0-9]{1,10}')->name('companies.show');
    Route::get('/quotations', [QuotationController::class, 'index'])->name('quotations.index');
    Route::get('/quotations/{id}', [QuotationController::class, 'show'])->where('id', '[0-9]{1,10}')->name('quotations.show');
});
