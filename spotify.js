const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  refreshToken: process.env.REFRESH_TOKEN
});

async function main() {
  try {
    // Refresh the access token
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
  } catch (error) {
    console.error('Failed to refresh access token:', error.message);
    process.exit(1);
  }

  let response;
  try {
    // Get top 10 artists (short_term)
    response = await spotifyApi.getMyTopArtists({
      limit: 10,
      time_range: 'short_term'
    });
  } catch (error) {
    console.error('Failed to fetch top artists:', error.message);
    process.exit(1);
  }

  const topArtists = response.body.items.map(artist => ({
    name: artist.name,
    genres: artist.genres,
    popularity: artist.popularity,
    url: artist.external_urls.spotify
  }));

  // Save to JSON file
  fs.writeFileSync('spotify_top.json', JSON.stringify(topArtists, null, 2));
  console.log('Top artists saved to spotify_top.json');
}

main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
