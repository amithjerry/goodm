# Amith — independent web designer & developer

A responsive portfolio built with plain HTML, CSS, and JavaScript, plus a small Node.js backend for enquiry storage and admin access. No package installation or framework is required.

## Run the portfolio

- The enquiry form and admin dashboard need the Node.js server; opening `index.html` directly will not save enquiries.
- Start the server in PowerShell:

  ```powershell
  node server.js
  ```

- Open `http://localhost:4173`. For a phone preview, allow Windows Firewall access on **Private networks** only and open the phone address printed in the terminal.
- Press **Ctrl+C** in the terminal to stop the server.

## Admin dashboard and enquiries

1. In the contact form, enter `admin` in all three fields (name, email, and project message) and submit. The admin dashboard opens without saving an enquiry.
2. Customer enquiries are written to `.portfolio-data/server-enquiries.json` on the server and remain there across browser sessions and server restarts until deleted from the dashboard.
3. Use **Enquiries** to view or permanently delete saved messages. Older enquiries in this browser's local storage are imported after the first successful admin sign-in.
4. **Selected work tiles** still use this browser's local storage; those edits are not shared across browsers or devices.

**Security warning:** `admin` is a fixed, publicly known demo password. Anyone who can reach the server can access or delete all enquiries. Use this only for a local or trusted private-network preview; do not deploy it publicly or collect real customer information with it. Admin sessions use an HTTP-only cookie and expire after eight hours. The local preview server uses plain HTTP.

Enquiries are stored on the server's disk, not in a managed database. They persist until an admin deletes them as long as that storage remains intact; server or disk failure, host replacement, or a deployment without a persistent disk can still lose data. Back up `.portfolio-data/server-enquiries.json` and configure persistent storage with your hosting provider. The existing `.portfolio-data/store.json` is separate and is not modified.

## Customize and publish

1. Update `contactEmail` in [`assets/js/config.js`](./assets/js/config.js) for the visible email links.
2. Update the name, introduction, services, and availability in `index.html`.
3. The eight case studies are fictional, self-initiated concepts. Keep those labels visible or replace the concepts with accurate project details before presenting them as client work.
4. You can manage the displayed work tiles with the local admin dashboard. To make edits visible to other browsers or devices, edit the original HTML and deploy the updated files.
5. A static-only host cannot receive or retain enquiries. The current fixed `admin` password is not safe for a public deployment. Before publishing, replace it with secure authentication and deploy behind HTTPS on a host with persistent disk storage.
6. Back up enquiry storage regularly. Add canonical metadata and a domain-specific sitemap when the final public domain is known.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Portfolio landing page and local admin dashboard |
| `assets/css/site.css` | Shared responsive styles, project artwork, and case-study layouts |
| `assets/js/config.js` | Contact email configuration |
| `assets/js/site.js` | Navigation, contact links, and reveal effects |
| `assets/js/admin.js` | Enquiry form, server-backed admin dashboard, and local work-tile editor |
| `assets/js/portfolio.js` | Work tile rendering and local browser persistence |
| `projects/` | Eight linked, clearly labeled concept case studies |
| `server.js` | Static file server and enquiry API |
| `start-mobile-server.bat` | Windows shortcut for starting the local preview server |
| `404.html` | Branded not-found page for static hosts that support it |
| `assets/favicon.svg` | Browser and home-screen icon |
| `site.webmanifest` | Basic installable-site metadata |
| `robots.txt` | Allows search engine crawlers |

## Privacy

The portfolio has no analytics or tracking cookies. Enquiries are stored on the server until an admin deletes them; protect the storage file and provide backups. Do not collect sensitive information in the form. Public deployments must use HTTPS. The site loads its typefaces from Google Fonts when the visitor is online; remove the Google Fonts links in `index.html` if you need a fully self-hosted site.
