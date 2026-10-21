<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\Read\CompanyController;
use App\Http\Controllers\Read\QuotationController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/health', HealthController::class)->name('health');

Route::get('/', fn () => Inertia::render('Home'))->name('home');

/* Wave 1 · Session D — legacy data, READ ONLY. GET routes only; nothing here
   writes. Authentication is added in front of these by Session C. */
Route::get('/companies', [CompanyController::class, 'index'])->name('companies.index');
Route::get('/companies/{id}', [CompanyController::class, 'show'])->where('id', '[0-9]{1,10}')->name('companies.show');
Route::get('/quotations', [QuotationController::class, 'index'])->name('quotations.index');
Route::get('/quotations/{id}', [QuotationController::class, 'show'])->where('id', '[0-9]{1,10}')->name('quotations.show');
