import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  LifeBuoy,
  LoaderCircle,
  MessageSquare,
  Send,
  Ticket,
} from 'lucide-react';

const resourceCards = [
  {
    id: 'help-center',
    title: 'Documentation',
    description: 'Browse help articles and find answers for Tiwlo products.',
    icon: BookOpen,
    action: 'Explore articles',
  },
  {
    id: 'inbox',
    title: 'Support team',
    description: 'Talk to the Tiwlo support team and get help with your account.',
    icon: MessageSquare,
    action: 'Open support inbox',
  },
  {
    id: 'tickets',
    title: 'My tickets',
    description: 'Review your support requests and their latest updates.',
    icon: LifeBuoy,
    action: 'View my tickets',
  },
];

const topics = [
  'Droplets',
  'Billing',
  'Domains',
  'Store',
  'Mail',
  'POS System & Hardware',
  'Login & Authentication',
  'General Inquiry',
];

export default function HelpSupportHome({
  onNavigate,
  currentUser,
  onTicketCreated,
  onContactSupport
}) {
  const [category, setCategory] = useState('General Inquiry');
  const [priority, setPriority] = useState('Medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          priority,
          description: description.trim(),
          userId: currentUser?.id || currentUser?.tiwiId || '',
          userName: currentUser?.name || currentUser?.storeName || 'Tiwlo user',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ticket) {
        throw new Error(result.error || 'Your ticket could not be submitted. Please try again.');
      }
      setSubject('');
      setDescription('');
      onTicketCreated?.(result.ticket);
    } catch (submitError) {
      setError(submitError.message || 'Your ticket could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tiwi-v3-help-home flex w-full flex-col gap-8 pb-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Account
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
          Help &amp; support
        </h1>
        <p className="mt-2 text-sm text-neutral-600 sm:text-base">
          Docs, guides and our support team.
        </p>
      </header>

      <section aria-label="Help resources" className="grid gap-4 md:grid-cols-3">
        {resourceCards.map(({ id, title, description: cardDescription, icon: Icon, action }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className="group flex min-h-40 flex-col items-start rounded-3xl bg-white p-5 text-left ring-1 ring-neutral-200 transition hover:-translate-y-0.5 hover:ring-neutral-300 hover:shadow-sm sm:p-6"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-[#1ed760] text-black">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="mt-4 text-base font-bold text-neutral-950">{title}</span>
            <span className="mt-1 flex-1 text-sm leading-6 text-neutral-600">{cardDescription}</span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-neutral-900">
              {action}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </button>
        ))}
      </section>

      <section className="tiwi-v3-help-ticket rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-7">
        <div className="mb-6 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e8faef] text-[#137a39]">
            <Ticket className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">Open a support ticket</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Tell us what you need help with. You can follow updates from your tickets.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid max-w-4xl gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-neutral-800">
            Topic
            <select
              value={category}
              onChange={event => setCategory(event.target.value)}
              className="h-11 w-full rounded-xl bg-[#f4f4f4] px-4 text-sm font-normal text-neutral-900 outline-none ring-neutral-900/10 transition focus:bg-white focus:ring-2"
            >
              {topics.map(topic => <option key={topic}>{topic}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-neutral-800">
            Priority
            <select
              value={priority}
              onChange={event => setPriority(event.target.value)}
              className="h-11 w-full rounded-xl bg-[#f4f4f4] px-4 text-sm font-normal text-neutral-900 outline-none ring-neutral-900/10 transition focus:bg-white focus:ring-2"
            >
              {['Low', 'Medium', 'High', 'Urgent'].map(option => <option key={option}>{option}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-neutral-800 sm:col-span-2">
            Subject
            <input
              type="text"
              value={subject}
              onChange={event => setSubject(event.target.value)}
              maxLength={100}
              placeholder="What do you need help with?"
              required
              className="h-11 w-full rounded-xl bg-[#f4f4f4] px-4 text-sm font-normal text-neutral-900 outline-none ring-neutral-900/10 transition placeholder:text-neutral-500 focus:bg-white focus:ring-2"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-neutral-800 sm:col-span-2">
            Describe the issue
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              rows={5}
              placeholder="Include any details that will help us resolve your request."
              required
              className="w-full resize-y rounded-xl bg-[#f4f4f4] px-4 py-3 text-sm font-normal text-neutral-900 outline-none ring-neutral-900/10 transition placeholder:text-neutral-500 focus:bg-white focus:ring-2"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-2 text-sm text-neutral-600">
              <CircleHelp className="size-4 shrink-0" aria-hidden="true" />
              Average first response time: under 2 hours.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1ed760] px-5 text-sm font-bold text-black transition hover:bg-[#18c755] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
              {submitting ? 'Submitting…' : 'Submit ticket'}
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onContactSupport || (() => onNavigate('inbox'))}
            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-800 transition hover:text-neutral-500"
          >
            <LifeBuoy className="size-4" aria-hidden="true" />
            Need urgent help? Contact support
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
