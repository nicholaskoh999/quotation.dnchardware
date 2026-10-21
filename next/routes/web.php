<?php

use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/health', HealthController::class)->name('health');

Route::get('/', fn () => Inertia::render('Home'))->name('home');
