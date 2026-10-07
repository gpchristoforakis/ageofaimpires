# Entry notification signup

The HOW-TO closing card opens a modal form and posts the supplied name and email
to `/api/subscribe`. The existing Cloudflare Pages `_worker.js` stores the contact
in a dedicated Resend segment. It does not send an email on signup or send broadcasts
when Git changes. Notifications are sent separately when an entry is published.

## Cloudflare Pages configuration

- Create or select a Resend segment reserved for AGE OF AIMPIRES entry notifications.
- Set `RESEND_ENTRY_SEGMENT_ID` to that segment's ID.
- Set the secret `RESEND_SUBSCRIBE_API_KEY` to a Resend key with contact-management
  access. The handler falls back to the existing `RESEND_API_KEY`; a sending-only
  key cannot manage contacts. Never put keys in HTML or commit them to Git.
- Configure these values for the intended Pages deployment environment.

Resend API references:
[create contact](https://resend.com/docs/api-reference/contacts/create-contact),
[update contact](https://resend.com/docs/api-reference/contacts/update-contact),
[add contact to segment](https://resend.com/docs/api-reference/contacts/add-contact-to-segment).

Missing configuration, denied credentials, and provider failures return an error;
the popup only shows the confirmation after the provider accepts the signup.
The plain static preview server cannot execute the Cloudflare worker.

## Activation and notifications

Before activating signups, verify the configured segment and contact permissions
with an authorized test signup. Check that the name is preserved and a repeated
signup does not create a duplicate. Verify the production sender and an actual
notification delivery before claiming that email notifications are operational.

Send entry announcements only to this segment. Each announcement must contain the
published entry's link and the Resend unsubscribe link. Do not use subscribers for
other marketing. Review the accompanying Privacy Policy update before publication.

Local tests use fake contacts and a mocked Resend API; they do not send emails or
create live subscribers.
