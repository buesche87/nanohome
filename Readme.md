# Get
git pull

# Build
docker build -t nanohome .

# Start
docker run -it \
    --env-file .env \
    --network=nanohome \
    --mount type=bind,src=/mnt/data/appdata/nanohome/config,dst=/opt/nanohome/config \
    --mount type=bind,src=/mnt/data/appdata/nanohome/log,dst=/opt/nanohome/log \
    --rm nanohome
