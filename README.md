# Influx Enterprise Installer
An automated and configurable installer for Influx Enterprise.  Currently this only installs the Meta and Data nodes.  But the next version will also handle Kapacitor, Chronograf, Telegraf, and setting up a load Balancer for writes and/or reads.

Other future enhancements will likely be:
* A UI so you don't have to edit a cluster.json file
* Installation to AWS to include provisioning your EC2 instances
* Support for other cloud providers like GCE, Azure, etc
* Support for containerized environments like Docker, Kubernetes

## Supported Operating Systems
* CentOS/RHEL/Fedora 7.X
* Ubuntu 14.04LTS or 16.04LTS

## Usage
1. create your cluster.json file in conf/cluster.json.  See below for configuration options
2. copy your SSH private key and set the location in the cluster.json file
3. Enter your Enterprise License Key

```bash
	./installer.js
```
Optionally if you want to have the output saved to a file for troubleshooting you can do the following:

```bash
	./installer.js > install.log
```

That's it! You now should have an Influx Enterprise cluster up and running.

## Pre-Requisites
1. All nodes have the OS installed
2. Password-less SSH Access has been setup on all nodes and you have the private key
3. List of all FQDN hostnames and IP addresses
4. You have an Influx Enterprise license key or file

## Configuration
Installer configuration is done through the .eirc.js file located in conf.  This is a file with configuration defined under the three objects:
* BASE_REPO_URL
* INFLUX_ENT_VERSION
* CONFIG

The CONIFG object is read at startup time to configure our environment.

### BASE_REPO_URL
Defines the base download path for our installation packages.  If you have setup a local repo you would change this path to reflect that base URL.
* Default setting: "https://dl.influxdata.com/enterprise/releases/"

### INFLUX_ENT_VERSION
The version of Influx Enterprise we are using.  Currently this parameter has no effect and is merely a placeholder

* Default setting: 1.2.1

### clusterBlueprintFile
The location of our cluster definition file.

* Default value: conf/cluster.json

### libDir
Path to our lib dir.  You probably shouldn't change this.

* Default value:
```javascript
path.resolve(__dirname, 'lib')
```

### appDir:
Path to our app dir.  You probably shouldn't change this.

* Default value:
```javascript
path.resolve(process.cwd(), 'app')
```

### tmpDir:
Path to our tmp dir.  You probably shouldn't change this.

* Default value:
```javascript
path.resolve(process.cwd(), 'tmp')
```

### logger:
Sets up the console logger

* Default value:
```javascript
{
	logLevel: 'INFO',
	dateFormat: 'HH:mm:ss.SSS'
}
```

### packages:
This defines the path for our packages download

* Default value:
```javascript
packages: {
	telegraf: {
		base: url.resolve(BASE_REPO_URL, 'telegraf/releases/'),
		ubuntu: 'telegraf_1.2.1_amd64.deb',
		centos: 'telegraf-1.2.1.x86_64.rpm'
	},
	metaNode: {
		base: url.resolve(BASE_REPO_URL, 'enterprise/releases/'),
		ubuntu: 'influxdb-meta_1.2.1-c1.2.2_amd64.deb',
		centos: 'influxdb-meta-1.2.1_c1.2.2.x86_64.rpm'
	},
	dataNode: {
		base: url.resolve(BASE_REPO_URL, 'enterprise/releases/'),
		ubuntu: 'influxdb-data_1.2.1-c1.2.2_amd64.deb',
		centos: 'influxdb-data-1.2.1_c1.2.2.x86_64.rpm'
	},
	loadBalancer: {
		base: 'http://',
		ubuntu: 'nothing',
		centos: 'nothing'
	},
	chronograf: {
		base: url.resolve(BASE_REPO_URL, 'chronograf/releases/'),
		ubuntu: 'chronograf_1.2.0~beta9_amd64.deb',
		centos: 'chronograf-1.2.0~beta9.x86_64.rpm'
	},
	kapacitor: {
		base: url.resolve(BASE_REPO_URL, 'kapacitor/releases/'),
		ubuntu: 'kapacitor_1.2.0_amd64.deb',
		centos: 'kapacitor-1.2.0.x86_64.rpm'
	}
}
```

## Cluster Definition
A cluster is defined through a cluster.json file.  This file can be located anywhere but the default location is in conf/cluster.json

### name:
The name of our cluster
* Default value: "myCluster"

### version:
The version of Influx Enterprise we want to install

* Default value: "1.2"

### OS:
The Operating System type we are installing to.  Acceptable values are:

1. centos <-- This covers the RHEL/Fedora/Centos family
2. ubuntu <-- Thsi covers the Ubuntu/Debian family

* Default value: "centos"

### sshKeyFile:
The location of the private key we will use for passwordless ssh login.  There is no default value for this setting and it must be specified.

### username:
The username we will use for login to our servers.

* Default value: "root"

### license-key:
The bvalue of your Influx Enterprise License Key.  There s no default value and this must be specified.

### hosts:
An array containing the definition for all the hosts we want to install to.  By default this array is empty and must be specified. An example of what this array will look like might be the following:

```json
"hosts": [{
		"hostname": "node1.influxdata.com",
		"ip": "192.168.70.101",
		"services": [
			"metaNode", "dataNode"
		]
	},
	{
		"hostname": "node2.influxdata.com",
		"ip": "192.168.70.102",
		"services": [
			"metaNode", "dataNode", "loadbalancer"
		]
	},
	{
		"hostname": "node3.influxdata.com",
		"ip": "192.168.70.103",
		"services": [
			"metaNode", "dataNode"
		]
	}
]
```

### hostname:
The FQDN of our host.  There is no default value and this must be specified for each host.

### ip:
The IP address of our host.  There is no default value and this must be specified for each host.

### services:
A String array containing which services will be installed on this host.  Acceptable values are:
* dataNode
* metaNode
* loadBalancer

In the future this will also support:
* kapacitorNode
* chronograf
* telegraf

For example:
```json
["metaNode", "dataNode"]
```

### services
A array that defines all the configuration parameters for our services.  The values contained here will be copied to ur config files for that particular service.  For example what you define under metaNode will be placed into the influxdb-meta.conf file on each metaNode host.  Please refer to the Influx Docs at [https://docs.influxdata.com/](https://docs.influxdata.com/) for a a description of the configuration parameters for each service.  Below is an example that has all the default settings for each service.  It is recommended to only define the parameters that will override default values.

```json
"services": [{
		"name": "metaNode",
		"config": {
			"reporting-disabled": false,
			"bind-address": "",
			"hostname": "",
			"enterprise": {
				"registration-enabled": true,
				"registration-server-url": "",
				"license-key": "",
				"license-path": ""
			},
			"meta": {
				"dir": "/var/lib/influxdb/meta",
				"retention-autocreate": true,
				"logging-enabled": true,
				"bind-address": ":8089",
				"auth-enabled": false,
				"http-bind-address": ":8091",
				"https-enabled": false,
				"https-certificate": "",
				"https-private-key": "",
				"https-insecure-tls": false,
				"gossip-frequency": "5s",
				"announcement-expiration": "30s",
				"election-timeout": "1s",
				"heartbeat-timeout": "1s",
				"leader-lease-timeout": "500ms",
				"consensus-timeout": "30s",
				"commit-timeout": "50ms",
				"cluster-tracing": false,
				"pprof-enabled": true,
				"lease-duration": "1m0s",
				"shared-secret": "",
				"internal-shared-secret": ""
			}
		}
	},
	{
		"name": "dataNode",
		"config": {
			"reporting-disabled": false,
			"bind-address": ":8088",
			"hostname": "",
			"gossip-frequency": "3s",
			"enterprise": {
				"registration-enabled": true,
				"registration-server-url": "",
				"license-key": "",
				"license-path": ""
			},
			"meta": {
				"dir": "/var/lib/influxdb/meta",
				"meta-tls-enabled": false,
				"meta-insecure-tls": false,
				"meta-auth-enabled": false,
				"meta-internal-shared-secret": "",
				"retention-autocreate": true,
				"logging-enabled": true
			},
			"data": {
				"dir": "/var/lib/influxdb/data",
				"wal-dir": "/var/lib/influxdb/wal",
				"query-log-enabled": true,
				"cache-max-memory-size": 524288000,
				"cache-snapshot-memory-size": 26214400,
				"cache-snapshot-write-cold-duration": "10m0s",
				"compact-full-write-cold-duration": "24h0m0s",
				"max-series-per-database": 1000000,
				"max-values-per-tag": 100000,
				"trace-logging-enabled": false
			},
			"cluster": {
				"dial-timeout": "1s",
				"shard-writer-timeout": "5s",
				"shard-reader-timeout": "0",
				"max-remote-write-connections": 50,
				"cluster-tracing": false,
				"write-timeout": "10s",
				"max-concurrent-queries": 0,
				"query-timeout": 0,
				"log-queries-after": 0,
				"max-select-point": 0,
				"max-select-series": 0,
				"max-select-buckets": 0
			},
			"retention": {
				"enabled": true,
				"check-interval": "30m0s"
			},
			"shard-precreation": {
				"enabled": true,
				"check-interval": "10m0s",
				"advance-period": "30m0s"
			},
			"admin": {
				"enabled": false,
				"bind-address": ":8083",
				"https-enabled": false,
				"https-certificate": "/etc/ssl/influxdb.pem"
			},
			"monitor": {
				"store-enabled": true,
				"store-database": "_internal",
				"store-interval": "10s",
				"remote-collect-interval": "10s"
			},
			"subscriber": {
				"enabled": true,
				"http-timeout": "30s",
				"insecure-skip-verify": false,
				"ca-certs": "",
				"write-concurrency": 40,
				"write-buffer-size": 1000
			},
			"http": {
				"enabled": true,
				"bind-address": ":8086",
				"auth-enabled": false,
				"log-enabled": true,
				"write-tracing": false,
				"pprof-enabled": true,
				"https-enabled": false,
				"https-certificate": "/etc/ssl/influxdb.pem",
				"https-private-key": "",
				"max-row-limit": 10000,
				"max-connection-limit": 0,
				"shared-secret": "",
				"realm": "InfluxDB",
				"unix-socket-enabled": false,
				"bind-socket": "/var/run/influxdb.sock"
			},
			"continuous_queries": {
				"log-enabled": true,
				"enabled": true,
				"run-interval": "1s"
			},
			"hinted-handoff": {
				"dir": "/var/lib/influxdb/hh",
				"enabled": true,
				"max-size": 10737418240,
				"max-age": "168h0m0s",
				"retry-conncurrency": 20,
				"retry-rate-limit": 0,
				"retry-interval": "1s",
				"retry-max-interval": "10s",
				"purge-interval": "1m0s"
			}
		}
	}
]
```
