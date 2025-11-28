const SpotifyWebApi = require("spotify-web-api-node");
const fs = require("fs");

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  refreshToken: process.env.REFRESH_TOKEN,
});

async function main() {
  try {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body["access_token"]);
  } catch (error) {
    console.error("Failed to refresh access token:", error.message);
    process.exit(1);
  }

  let response;
  try {
    response = await spotifyApi.getMyTopArtists({
      limit: 10,
      time_range: "short_term",
    });
  } catch (error) {
    console.error("Failed to fetch top artists:", error.message);
    process.exit(1);
  }

  const topArtists = await Promise.all(
    response.body.items.map(async (artist) => {
      try {
        // Artist's albums
        const albums = await spotifyApi.getArtistAlbums(artist.id, {
          limit: 3,
        });

        return {
          id: artist.id,
          name: artist.name,
          genres: artist.genres,
          popularity: artist.popularity,
          followers: artist.followers.total,
          url: artist.external_urls.spotify,
          albums: albums.body.items.map((album) => ({
            name: album.name,
            release_date: album.release_date,
            total_tracks: album.total_tracks,
          })),
        };
      } catch (error) {
        console.error(
          `Failed to fetch additional data for artist ${artist.name}:`,
          error.message
        );
        return {
          id: artist.id,
          name: artist.name,
          genres: artist.genres,
          popularity: artist.popularity,
          followers: artist.followers.total,
          url: artist.external_urls.spotify,
          albums: [],
        };
      }
    })
  );

  fs.writeFileSync("spotify_top.json", JSON.stringify(topArtists, null, 2));
  console.log("Updated top artists saved to spotify_top.json");
}

main().catch((error) => {
  console.error("Unexpected error:", error.message);
  process.exit(1);
});
