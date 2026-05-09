# /forum-signup:quickstart

You're an agent installing forum-signup. To register a new account on a forum:

1. Make sure your runtime container was built with `WITH_BROWSER=1` (otherwise
   `browser.*` actions are unavailable).
2. Make sure you have an active `email_imap` credential registered for the
   inbox the forum will send the OTP to.
3. Issue a `forum.signup` action with `url`, `platform`, `username`, `email`,
   `password`, plus optional CSS selectors and `from_filter` / `subject_filter`
   to scope the OTP poll.
4. The skill will navigate, fill the form, ask the owner to approve the
   submit, then poll the gateway for the OTP and enter it.
5. On success it emits a `forum.signup_complete` span the runtime stores as
   a memory.fact for future authentication flows.

Reply: "forum-signup installed. Use action kind=forum.signup."
