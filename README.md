# Daily Dose

A privacy-first, installable medication reminder web app with an Android and iOS shell. The first version stores medication schedules and dose logs in the browser's local storage; no account or backend is required.

## Run locally

Install Node.js 22 or later, then run:

```sh
npm install
npm run dev
```

## Free startup hosting

Cloudflare Pages supports static site deployment on its Free plan. Connect the repository and set the build command to `pnpm build` (or `npm run build`) and the output directory to `dist`. `public/_redirects` provides an SPA fallback. A custom domain is optional; a `pages.dev` address is enough to start. Check current plan limits before launch.

Vercel configuration is also included for compatibility. Vercel's free Hobby plan is restricted to personal, non-commercial use, so use it only for a non-commercial prototype or choose a suitable paid plan for a startup deployment.

## Mobile shells

After installing dependencies and creating a web build:

```sh
npx cap add android
npx cap add ios
npm run cap:sync
npm run cap:android
npm run cap:ios
```

Android development needs Android Studio and the Android SDK. iOS builds require macOS and Xcode. Configure and test notification permissions on actual devices. For more precise Android schedules, after generating the Android project, add `android.permission.SCHEDULE_EXACT_ALARM` in `android/app/src/main/AndroidManifest.xml` and guide users to allow exact alarms in system settings. Android may otherwise deliver scheduled notifications inexactly. Notifications can also be denied or suppressed by device settings.

## Reminder and storage limits

- The native shells use local notifications and do not need a push server.
- The browser build can show a reminder while the app page is open and notifications are permitted. A web page cannot guarantee reminders while closed or suspended. Use the Android or iOS app for scheduled device notifications.
- Native reminders currently queue up to 60 future occurrences per medication when added. Reopen the app after a schedule change to refresh its queue.
- Local storage is tied to the browser/device. Clearing app data removes schedules and history. Cloud sync and backups are not included.
- This is a reminder and logging tool, not medical advice or a substitute for a prescription.

## MVP scope

- Add a medication name, strength, form, category, daily reminder times, course dates, and optional personal note.
- Review today's schedule, log a dose as taken or skipped, and see recent dose history.
- Keep user data on-device by default.

## Later before public release

Add data export/restore, edit-medication flow, reminder rescheduling on edits/time changes, accessible permission education, privacy policy, and platform-specific notification behavior testing. Do not rely on a browser timer as a dependable alarm.
