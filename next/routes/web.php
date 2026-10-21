<?php

use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/health', HealthController::class)->name('health');

Route::get('/', fn () => Inertia::render('Home'))->name('home');

/* App-shell routes (Wave 1 Session A). Honest placeholder pages; later
   sessions replace the page component behind a route, never its name. */
Route::inertia('/quotations', 'Quotations/Index')->name('quotations.index');
Route::inertia('/quotations/new', 'Quotations/Create')->name('quotations.create');
Route::inertia('/companies', 'Companies/Index')->name('companies.index');
Route::inertia('/price-lookup', 'PriceLookup')->name('price-lookup');
Route::inertia('/calculator', 'Calculator')->name('calculator');
Route::inertia('/system-health', 'SystemHealth')->name('system-health');
Route::inertia('/settings', 'Settings')->name('settings');
