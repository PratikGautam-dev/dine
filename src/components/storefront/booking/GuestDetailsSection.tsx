"use client";

// Ported from dine-client's components/booking/GuestDetailsSection.tsx -- props and logic
// unchanged, classes re-skinned with sf- tokens, CheckoutSection -> local BookingSection.
import React from 'react';
import { cn } from '@/lib/cn';
import { ACCOMMODATIONS, EMAIL_PATTERN, OCCASIONS, isValidPhone } from './bookingData';
import { BookingSection } from './BookingSection';

interface GuestDetailsSectionProps {
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  occasion: string;
  setOccasion: (v: string) => void;
  accommodations: string[];
  toggleAccommodation: (id: string) => void;
  request: string;
  setRequest: (v: string) => void;
}

const inputClass =
  'w-full h-11 pl-9 pr-3 rounded-lg bg-sf-surface-container-low text-sf-on-surface font-sf-body text-sm placeholder:text-sf-text-muted focus:bg-sf-surface focus:outline-none focus:ring-2 focus:ring-sf-primary aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-sf-error transition-all';

export function GuestDetailsSection({
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  occasion,
  setOccasion,
  accommodations,
  toggleAccommodation,
  request,
  setRequest,
}: GuestDetailsSectionProps) {
  const phoneInvalid = phone.length > 0 && !isValidPhone(phone);
  const emailInvalid = email.length > 0 && !EMAIL_PATTERN.test(email);

  return (
    <BookingSection
      id="booking-step-3"
      step={3}
      title="Guest Details & Occasion"
      subtitle="Customized dining hospitality setup"
      action={
        <span className="font-sf-body text-xs text-sf-primary font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">celebration</span>
          Special Requests Welcome
        </span>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label htmlFor="guest-name" className="font-sf-body text-xs font-semibold text-sf-on-surface block mb-1">
            Full Name *
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-sf-text-muted pointer-events-none">
              badge
            </span>
            <input
              id="guest-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name on the reservation"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="guest-phone" className="font-sf-body text-xs font-semibold text-sf-on-surface block mb-1">
            Phone (SMS/WhatsApp) *
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-sf-text-muted pointer-events-none">
              call
            </span>
            <input
              id="guest-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="10-digit mobile number"
              aria-invalid={phoneInvalid}
              className={inputClass}
            />
          </div>
          {phoneInvalid && <p className="font-sf-body text-xs text-sf-error mt-1">Enter a valid 10-digit number.</p>}
        </div>
        <div>
          <label htmlFor="guest-email" className="font-sf-body text-xs font-semibold text-sf-on-surface block mb-1">
            Email ID
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-sf-text-muted pointer-events-none">
              mail
            </span>
            <input
              id="guest-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="For your booking pass"
              aria-invalid={emailInvalid}
              className={inputClass}
            />
          </div>
          {emailInvalid && <p className="font-sf-body text-xs text-sf-error mt-1">Enter a valid email address.</p>}
        </div>
      </div>

      <div className="mb-5">
        <p className="font-sf-body text-sm font-semibold text-sf-on-surface mb-2">Celebrating something special?</p>
        <div role="radiogroup" aria-label="Occasion" className="flex flex-wrap gap-2">
          {OCCASIONS.map((item) => {
            const selected = item === occasion;
            return (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setOccasion(item)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full font-sf-body text-sm transition-colors cursor-pointer',
                  selected
                    ? 'bg-sf-primary-light text-sf-primary font-semibold ring-1 ring-sf-primary'
                    : 'bg-sf-surface-container-low hover:bg-sf-surface-container text-sf-on-surface font-medium'
                )}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="font-sf-body text-sm font-semibold text-sf-on-surface mb-2">Dining Notes & Accommodations</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ACCOMMODATIONS.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-sf-surface-container-low cursor-pointer hover:bg-sf-surface-container transition-colors"
            >
              <input
                type="checkbox"
                checked={accommodations.includes(item.id)}
                onChange={() => toggleAccommodation(item.id)}
                className="w-4 h-4 rounded accent-sf-primary"
              />
              <span className="font-sf-body text-xs text-sf-on-surface">{item.label}</span>
            </label>
          ))}
        </div>
        <input
          type="text"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          aria-label="Special request"
          placeholder="Allergies, accessibility needs, anything else (optional)..."
          className="mt-3 w-full h-11 px-4 bg-sf-surface-container-low rounded-lg font-sf-body text-sm text-sf-on-surface placeholder:text-sf-text-muted focus:bg-sf-surface focus:outline-none focus:ring-2 focus:ring-sf-primary transition-all"
        />
      </div>
    </BookingSection>
  );
}
