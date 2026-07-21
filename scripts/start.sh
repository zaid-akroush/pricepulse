#!/usr/bin/env bash
# start.sh is retired. PricePulse used to run its backend on a laptop and
# expose it through a Cloudflare quick tunnel, which is what this script
# automated. The backend is now hosted permanently on Render and the
# frontend auto-deploys from GitHub via Cloudflare Pages, so there is
# nothing to start locally to keep the live site online.
#
# For local development, use docker-compose instead:
#   docker-compose up
#
# See README.md, "Hosting" section, for the one-time production setup.

echo "start.sh is no longer needed. The live site deploys itself on every git push."
echo "For local development, run: docker-compose up"
echo "See README.md for details."
