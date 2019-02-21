# Node-RED Nodes

First-party Node-RED nodes for Pimoroni products.

These nodes are for the Raspberry Pi only. Please also make sure you have installed the relevant Python libraries before running them.

## Other Products

Some of our products have third-party Node-RED nodes, which you can find below:

* Rainbow HAT by @cyberflohr - https://github.com/cyberflohr/node-red-contrib-rainbow-hat
* Automation HAT/pHAT by @shortbloke - https://github.com/shortbloke/node-red-contrib-automation-hat

## Installing

### Flotilla

To install Flotilla just change into your node-red user directory and install like so:

```
cd ~/.node-red/
npm install node-red-node-contrib-flotilla
```

### Everything else...

Currently the individual add-on boards are a work in progress, and aren't available via npm.

To install them, you should create/enter the folder:

```
/home/pi/.node-red/nodes/
```

And then you can just clone this repository, like so:

```
git clone http://github.com/pimoroni/node-red-nodes pimoroni-nodes
```

Then fire up Node-RED and enjoy!

## Updating

Just enter the folder:

```
/home/pi/.node-red/nodes/pimoroni-nodes
```

And run `git pull origin master` to update.
