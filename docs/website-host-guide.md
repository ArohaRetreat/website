# Host studio guide

Open `/admin/` on the published Aroha site and continue with Google. Use an approved owner account or the exact verified Google email that was invited. Signing in alone does not grant editing access.

See the [public roadmap](public/roadmap.md) for planned improvements and the [website release notes](public/releases.md) for updates available to hosts and guests.

Choose a section in the studio to edit its text, photos, prices, contacts, FAQs or design settings. Page layout controls section order and visibility. The hero has separate desktop and mobile photo fields. Add, reorder or remove repeated items; keep stable IDs when changing existing items. Images should be web-ready JPEG, PNG, WebP or AVIF below 10 MB. Uploading makes the image public immediately; selecting it in a draft does not publish the draft.

Save draft preserves the changes privately. Preview shows the current draft without replacing the public site. Publish requires admin/super-admin access and explicit confirmation. If another host saved first, export your backup, reload the current draft and reconcile your changes; a stale draft cannot silently overwrite it. Published history restores an earlier version into a new draft, which must be reviewed and published separately.

People & access creates seven-day invitations and provides a link to share manually. No invitation email is sent. Admins manage editors/viewers; super-admins can manage admins. Editors save drafts but cannot publish or manage people. Viewers read only. Protected owner identities cannot be changed through this screen. Revoke access to stop future protected operations.

The guest form prepares a WhatsApp enquiry for the guest to review and send. It does not confirm availability, hold a room or take payment. Hosts confirm the visit personally. Update provisional copy, tariff details and accurately matched room photographs before relying on them in customer conversations.

The cinematic public view uses the final journey photograph for its evening atmosphere and closing invitation. Keep that chapter paired with an evening image when changing photographs. Simple View presents all journey chapters without spatial movement; guests can switch views at any time.

## Mixed booking products (0.18.0)

Open `/admin/` and choose Bookings or Website changes. Both stay inside one authenticated workspace; switching preserves unsaved website edits. The old `/admin/bookings/` link forwards to the Bookings module. Review requests before approving. Day visits and overnight bookings share35 adult onsite places, while overnight adults also use the10-bed limit. Children under10 are listed separately. The calendar includes departure morning, shared sleeping places and day/event requests. Use Rooms & inventory for cleaning handover; a room that needs cleaning cannot be checked in. Future rooms remain closed until explicitly verified.

Booking policies configures product rates, adult limits and IST arrival/departure windows for new quotes. Rates & offers manages promo codes and loyalty offers. Existing reservations retain their totals and terms. Private rooms include the first two occupants and allow at most two adults and two children. Shared individual stays reserve sleeping places without private-room guarantees; hosts may assign available rooms.

Exclusive event enquiries initially do not reserve inventory. Send a host price offer, optionally holding exclusive availability up to24 hours. Guests must accept the current offer before host approval, which rechecks conflicts. Replacing an offer resets acceptance. Event date changes require a fresh enquiry and offer. Day visits/events never earn overnight loyalty credits. Email, external calendar sync and online payments remain disabled. The [booking rules](booking-products-contract.md) describe pricing and capacity in detail.

## Profiles, access and event ranges (0.19.0)

People & access independently assigns Website access and Bookings: No access, View bookings or Manage bookings. Website role continues to govern editing/publishing. Booking viewers cannot change inventory or reservations, including through direct API calls. Owner identities remain protected. Revocations apply on the next protected request. If concurrent staff changes conflict, refresh before saving again.

Guests can open My profile from their account or Profile inside the booking page. Save a name and international phone number, then review/edit the inherited details at the end of each booking. The optional save checkbox updates the profile for future visits; each reservation retains its own contact snapshot. Google email is read-only. Phone numbers are syntax-validated, not verified by SMS. Existing reservations remain accessible even when no phone was previously collected. Host contact lookup is separate from the bulk calendar.

Exclusive retreat uses Start date and End date, both inclusive. The approved reservation or explicit offer hold protects the entire interval from the first configured morning through the final18:00, including nights between dates. Accommodation needs an explicit host quote/agreement. An enquiry alone holds nothing. Existing single-day events retain their original time snapshots.

Operational booking business events in Dynatrace include server-validated contact.phone when a profile/booking contact exists. Names, email, private requests and child ages are excluded. Detailed browser steps follow optional monitoring consent; essential server and committed booking outcomes are operational records. Logs, metrics and traces exclude phone. New events use a durable retry queue; delivery can be delayed, and complete network/database outages can still leave capture gaps. Email delivery remains a separate next step.
