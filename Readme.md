# Get
git pull

# Build
docker build -t nanohome .

# Start
docker run -it --env-file .env --network=nanohome --rm nanohome

