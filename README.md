This project is for testing latency of different blockchain nodes (in this case Polygon mainnet and Polygon Amoy testnet, but can be any EVM compatible chain).

# Setup
1. Create `.env` file from `.env.example`:
```
cp .env.example .env
```
2. Set the right nodes values.

# Use

To run tests for Amoy (testnet) nodes:
```
npm run test:amoy
```
---
To run tests for Polygon (mainnet) nodes:
```
npm run test:polygon
```

## Docker Usage

This application can be run in a Docker container. Here's how to use it:

1. Build the Docker image:
```bash
docker build -t test-nodes .
```

2. Run the container with the following command:
```bash
docker run -d --name test-nodes-amoy \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/.env:/app/.env \
  test-nodes npm run test:amoy
```

Or for Polygon network:
```bash
docker run -d --name test-nodes-polygon \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/.env:/app/.env \
  test-nodes npm run test:polygon
```

The commands above:
- Run the container in detached mode (`-d`)
- Give the container a specific name (`--name`)
- Mount the local `output` directory to `/app/output` in the container
- Mount your local `.env` file to `/app/.env` in the container
- Run the specified npm script

To check the container logs:
```bash
docker logs test-nodes-amoy
# or
docker logs test-nodes-polygon
```

To stop the container:
```bash
docker stop test-nodes-amoy
# or
docker stop test-nodes-polygon
```

To remove the container:
```bash
docker rm test-nodes-amoy
# or
docker rm test-nodes-polygon
```

The results will be available in your local `output` directory after the container completes its execution.