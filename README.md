# Weekly Compass

A weekly planner built on Habit 3 of Stephen Covey's *The 7 Habits of Highly Effective People*: **Put First Things First**.

It follows Covey's weekly planning process:

1. **Connect to your mission.** Write a personal mission statement that guides everything else.
2. **Identify your roles.** Each role gets a color. The app starts with: Tonic Chairman, Sales, Delivery & Developer, Finance & Housekeeper, Relationship Builder, Innovator, Jiu Jitsu.
3. **Set goals for each role.** Each goal has a measure of success, a plan, a target date and a status.
4. **Turn goals into tasks.** Each week, choose the tasks that move your goals forward. Each task has a Quadrant (Q1–Q4) and a priority (A/B/C).
5. **Break tasks into actions.** Every task can hold a checklist of concrete action steps.
6. **Schedule the big rocks.** Drag tasks from the "Big rocks" tray onto days and give them a time.
7. **Evaluate.** The Review tab shows completion, how much of your week was Quadrant II, how many goals you moved forward, and how balanced your roles were. There's also space for a written reflection.

## Planning a month ahead

The **Month** tab shows the whole month with your tasks (in role colors), goal target dates (🎯) and your existing Google Calendar events. Click **+** on any date to add a task, drag tasks between days, or click a date to plan that week in detail. Use the arrows to move a month at a time. Any task's date can be set to any day in its edit window.

## Weekly planning ritual

Planning happens **last thing on Friday** (default 4:30pm, adjustable in Settings). From that time on planning day, a banner appears. **Plan next week** jumps to the coming week (weeks run Monday–Sunday) so you can set its big rocks. A matching recurring 30-minute "Weekly Compass planning" event in Google Calendar gives a pop-up reminder.

## Color code

Every goal and task takes its **role's color**, so your week shows at a glance which roles are getting attention. The role colors are the same 11 colors Google Calendar uses for events, so tasks synced to Google Calendar keep their color.

Quadrant badges mark urgency and importance:

| Badge | Quadrant | Meaning |
|---|---|---|
| **Q1** | Urgent & Important | Necessity: crises, deadlines |
| **Q2** | Not Urgent & Important | Quality: planning, relationships, renewal. Aim to spend most of your time here |
| **Q3** | Urgent & Not Important | Deception: interruptions, some meetings |
| **Q4** | Not Urgent & Not Important | Waste: trivia, time-wasters |

## Running it

**Live app:** https://waldronbrad-tech.github.io/First-one/

GitHub Pages redeploys automatically on every push (`.github/workflows/pages.yml`).

To run it locally instead (no build step):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Your data is saved in your browser (`localStorage`). Use **Settings → Export backup** to move it to another device.

## Google Calendar sync

Once connected, sync is **automatic and two-way**:

- Every scheduled task becomes an event in its role's color. The role, goal, quadrant and action steps go in the description, and completed tasks get a ✓.
- Every goal with a target date becomes an all-day 🎯 event that doesn't block your time.
- Any change in the app (new task, new time, done, deleted, role color) is pushed within a couple of seconds.
- Moving, renaming or deleting a synced event in Google Calendar updates the app the next time it syncs (when you open or switch views, return to the tab, or every 5 minutes). If you changed the same item in both places, the app's version wins.
- Your other Google Calendar events show in the Week and Month views, so you plan around real commitments.
- The header button shows sync status. Google sign-in lasts about an hour. After that it shows **Reconnect**. Changes made in the meantime are kept and sent when you reconnect.

**Export .ics** on the Week tab still works without connecting.

### One-time setup (about 5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → choose *External*, fill in the app name, and add your Gmail address as a **test user**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Web application**.
   Under **Authorized JavaScript origins** add `https://waldronbrad-tech.github.io` (and `http://localhost:8000` if you run it locally).
5. Copy the Client ID into **Settings → Google Calendar → OAuth Client ID** in the app, then click **Connect Google Calendar** in the header.

The app requests only the `calendar.events` scope. The access token stays in the browser tab and is never stored.

## Project layout

```
index.html       App shell
css/styles.css   Styles (light and dark themes)
js/app.js        Roles, goals, tasks, actions, week planning, review
js/gcal.js       Google sign-in and Calendar API calls
```
