# spotify-stats

Automatically fetches and displays your top 10 Spotify artists.

## Setup

### Required Secrets

Add the following secrets to your GitHub repository (Settings > Secrets and variables > Actions):

- `CLIENT_ID`: Your Spotify application Client ID
- `CLIENT_SECRET`: Your Spotify application Client Secret
- `REFRESH_TOKEN`: Your Spotify refresh token (see below for how to generate)

### Manual Token Generation

1. Create a Spotify application at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Set the redirect URI to `http://localhost:8888/callback`
3. Get your Client ID and Client Secret from the application settings
4. To generate a refresh token:
   - Visit the Spotify authorization URL:
     ```
     https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost:8888/callback&scope=user-top-read
     ```
   - After authorizing, you'll be redirected to a URL with a `code` parameter
   - Exchange the code for tokens:
     ```bash
     curl -X POST https://accounts.spotify.com/api/token \
       -H "Content-Type: application/x-www-form-urlencoded" \
       -d "grant_type=authorization_code" \
       -d "code=YOUR_CODE" \
       -d "redirect_uri=http://localhost:8888/callback" \
       -d "client_id=YOUR_CLIENT_ID" \
       -d "client_secret=YOUR_CLIENT_SECRET"
     ```
   - Save the `refresh_token` from the response

## How It Works

The GitHub Actions workflow runs hourly to:
1. Fetch your top 10 artists from Spotify (based on short-term listening history)
2. Save the results to `spotify_top.json`
3. Commit and push the changes to this repository