#!/usr/bin/env node  --harmony

'use strict';

console.log(process.cwd());
console.log(__dirname);
console.log(require.main.filename);

const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const sshPool = require('ssh-pool');
const log = require('nodelogger');
const toml = require('json2toml');
const CONFIG = require('./conf/.eirc');

/************************************************
 * INIT
 ************************************************/
//Logger
log.init(CONFIG.logger);
log.debug(CONFIG);

//Cluster Blueprint
let clusterBlueprint = JSON.parse(fs.readFileSync(path.resolve(__dirname, CONFIG.clusterBlueprintFile)));
log.info(clusterBlueprint + '\n');

//Make tmp working dir
if (!fs.existsSync(CONFIG.tmpDir)) {
	fs.mkdirSync(CONFIG.tmpDir);
}

// Get SSH KeyFile
let sshKeyFile = path.resolve(__dirname, clusterBlueprint.sshKeyFile);
if (fs.existsSync(sshKeyFile)) {
	log.info('Found SSH key at ' + sshKeyFile);
	//let sshKey = fs.readFileSync(sshKeyFile);
} else {
	log.error('No SSH private key file found at:  ' + sshKeyFile + ' cannot continue.  Exiting.');
	process.exit(1);
}

//Setup Hosts Lists and Connection Pool
let hosts = [];
_.each(clusterBlueprint.hosts, (host) => {
	hosts.push(clusterBlueprint.username + '@' + host.ip);
	if (!fs.existsSync(path.resolve(CONFIG.tmpDir, host.hostname))) {
		fs.mkdirSync(path.resolve(CONFIG.tmpDir, host.hostname));
	}
});
log.debug(JSON.stringify(hosts));
let allHosts = new sshPool.ConnectionPool(hosts, {
	'strict': 'false',
	'key': sshKeyFile
});


/************************************************
 * Setup Cluster Configuration
 *
 * Read cluster.json
 * Install Requirements
 * 		Updates
 * 		wget
 * 		ntpd
 ************************************************/
async function clusterPrep() {
	try {
		let cmdList = [];
		if (clusterBlueprint.OS.toLowerCase() === 'centos') {
			cmdList.push('yum install -y ' + CONFIG.deps);
		} else if (clusterBlueprint.OS.toLowerCase() === 'ubuntu') {
			cmdList.push('apt-get install -y ' + CONFIG.deps);
		} else {
			log.error(clusterBlueprint.OS + ' is not a recognized Operating System cannot continue.  Exiting.');
			process.exit(1);
		}
		cmdList.push('ntpdate -q ' + CONFIG.ntpSync);

		await execCmdS(allHosts, cmdList);
		await metaNodeInstall();
		await dataNodeInstall();
		log.warn('ALL DONE');
	} catch (err) {
		log.error(err);
		process.exit(1);
	}
}

/************************************************
 * Meta Node Installation
 *
 * On Each Hosts wehere a Meta Node will be installed download the installer
 * 		wget https://dl.influxdata.com/enterprise/releases/influxdb-meta_1.2.1-c1.2.2_amd64.deb
 *   	sudo dpkg -i influxdb-meta_1.2.1-c1.2.2_amd64.deb
 *    	wget https://dl.influxdata.com/enterprise/releases/influxdb-meta-1.2.1_c1.2.2.x86_64.rpm
 *     	sudo yum localinstall influxdb-meta-1.2.1_c1.2.2.x86_64.rpm
 * Edit the Config file
 * Start the Meta Service
 * 		service influxdb-meta start
 * Join the meta nodes to the cluster
 * Show the cluster
 ************************************************/
async function metaNodeInstall() {
	log.info('\n*************************\nMeta Node Installation\n*************************\n');
	let metaNodes = [];
	_.each(clusterBlueprint.hosts, (host) => {
		if (_.indexOf(host.services, 'metaNode') > -1) {
			metaNodes.push(clusterBlueprint.username + '@' + host.ip);
		}
	});

	let metaHosts = new sshPool.ConnectionPool(metaNodes, {
		'strict': 'false',
		'key': sshKeyFile
	});
	log.debug('MetaNodes: ' + JSON.stringify(metaNodes) + '\n*************************\n');

	try {
		// On all Meta Nodes do:
		if (clusterBlueprint.OS.toLowerCase() === 'centos') {
			log.info('Fetching MetaNode package from ' + CONFIG.packages.metaNode.centos);
			await execCmd(metaHosts, 'wget -O ' + CONFIG.packages.metaNode.centos + ' ' + CONFIG.packages.metaNode.base + CONFIG.packages.metaNode.centos);
		} else if (clusterBlueprint.OS.toLowerCase() === 'ubuntu') {
			log.info('Fetching MetaNode package from ' + CONFIG.packages.metaNode.ubuntu);
			await execCmd(metaHosts, 'wget -O ' + CONFIG.packages.metaNode.centos + ' ' + CONFIG.packages.metaNode.base + CONFIG.packages.metaNode.ubuntu);
		} else {
			log.error(clusterBlueprint.OS + ' is not a recognized Operating System cannot continue.  Exiting.');
			process.exit(1);
		}

		//Setup Meta Config File

		let metaConfig = _.find(clusterBlueprint.services, {
			'name': 'metaNode'
		}).config;
		metaConfig.enterprise['license-key'] = clusterBlueprint['license-key'];

		//On Each Meta Node do:
		for (let i = 0; i < clusterBlueprint.hosts.length; i++) {
			let host = clusterBlueprint.hosts[i];
			log.warn('Starting Meta Node Config Setup for ' + host.hostname);
			let confPath = path.resolve(CONFIG.tmpDir, host.hostname);
			metaConfig.hostname = host.hostname;
			let configToml = toml(metaConfig);
			log.info(configToml);
			let confFile = path.resolve(confPath, 'influxdb-meta.conf');

			fs.writeFileSync(confFile, configToml);
			let metaHost = new sshPool.ConnectionPool([clusterBlueprint.username + '@' + host.ip], {
				'strict': 'false',
				'key': sshKeyFile
			});
			log.info('Installing MetaNode Package');
			if (clusterBlueprint.OS.toLowerCase() === 'centos') {
				await execCmd(metaHost, 'yum localinstall -y ' + CONFIG.packages.metaNode.centos);
			} else if (clusterBlueprint.OS.toLowerCase() === 'ubuntu') {
				await execCmd(metaHosts, 'dpkg -i ' + CONFIG.packages.metaNode.ubuntu);
			}

			await metaHost.copy(confFile, '/etc/influxdb');
			await metaHost.run('sudo chown root:root /etc/influxdb/influxdb-meta.conf');
			await execCmd(metaHost, 'systemctl start influxdb-meta');
			await execCmd(metaHost, 'ps aux | grep -v grep | grep influxdb-meta');
		}

		let metaHostOne = new sshPool.ConnectionPool([clusterBlueprint.username + '@' + clusterBlueprint.hosts[0].ip], {
			'strict': 'false',
			'key': sshKeyFile
		});

		for (let i = 0; i < clusterBlueprint.hosts.length; i++) {
			let host = clusterBlueprint.hosts[i];
			await execCmd(metaHostOne, 'influxd-ctl add-meta ' + host.hostname + ':8091');
		}

		await execCmd(metaHostOne, 'influxd-ctl show');

	} catch (err) {
		log.error(err);
		throw new Error(err);
	}
}

/************************************************
 * Data Node Installation
 *
 *  * On Each Hosts wehere a Data Node will be installed download the installer
 * 	wget https://dl.influxdata.com/enterprise/releases/influxdb-data_1.2.1-c1.2.2_amd64.deb
 * 	sudo dpkg -i influxdb-data_1.2.1-c1.2.2_amd64.deb
 *    	wget https://dl.influxdata.com/enterprise/releases/influxdb-data-1.2.1_c1.2.2.x86_64.rpm
 *    	sudo yum localinstall influxdb-data-1.2.1_c1.2.2.x86_64.rpm
 * Edit the Config file
 * Start the Data Service
 * 		service influxdb start
 * Join the meta nodes to the cluster
 * Show the cluster
 ************************************************/
async function dataNodeInstall() {
	log.info('\n*************************\nData Node Installation\n*************************\n');
	let dataNodes = [];
	_.each(clusterBlueprint.hosts, (host) => {
		if (_.indexOf(host.services, 'dataNode') > -1) {
			dataNodes.push(clusterBlueprint.username + '@' + host.ip);
		}
	});

	let dataHosts = new sshPool.ConnectionPool(dataNodes, {
		'strict': 'false',
		'key': sshKeyFile
	});
	log.info('DataNodes: ' + JSON.stringify(dataNodes) + '\n*************************\n');

	try {
		// On all Data Nodes do:
		if (clusterBlueprint.OS.toLowerCase() === 'centos') {
			log.info('Fetching DetaNode package from ' + CONFIG.packages.dataNode.centos);
			await execCmd(dataHosts, 'wget -O ' + CONFIG.packages.dataNode.centos + ' ' + CONFIG.packages.dataNode.base + CONFIG.packages.dataNode.centos);
			log.info('Installing DataNode Package');
			await execCmd(dataHosts, 'yum localinstall -y ' + CONFIG.packages.dataNode.centos);
		} else if (clusterBlueprint.OS.toLowerCase() === 'ubuntu') {
			log.info('Fetching DataNode package from ' + CONFIG.packages.dataNode.ubuntu);
			await execCmd(dataHosts, 'wget -O ' + CONFIG.packages.dataNode.centos + ' ' + CONFIG.packages.dataNode.base + CONFIG.packages.dataNode.ubuntu);
			log.info('Installing DataNode Package');
			await execCmd(dataHosts, 'dpkg -i ' + CONFIG.packages.dataNode.ubuntu);
		} else {
			log.error(clusterBlueprint.OS + ' is not a recognized Operating System cannot continue.  Exiting.');
			process.exit(1);
		}

		//Setup Meta Config File
		let dataConfig = _.find(clusterBlueprint.services, {
			'name': 'dataNode'
		}).config;
		dataConfig.enterprise['license-key'] = clusterBlueprint['license-key'];

		//On Each Meta Node do:
		for (let i = 0; i < clusterBlueprint.hosts.length; i++) {
			let host = clusterBlueprint.hosts[i];
			log.warn('Starting Data Node Config Setup for ' + host.hostname);
			let confPath = path.resolve(CONFIG.tmpDir, host.hostname);
			dataConfig.hostname = host.hostname;
			let configToml = toml(dataConfig);
			log.info(configToml);
			let confFile = path.resolve(confPath, 'influxdb.conf');

			fs.writeFileSync(confFile, configToml);
			let dataHost = new sshPool.ConnectionPool([clusterBlueprint.username + '@' + host.ip], {
				'strict': 'false',
				'key': sshKeyFile
			});

			await dataHost.copy(confFile, '/etc/influxdb');
			await dataHost.run('sudo chown root:root /etc/influxdb/influxdb.conf');

			log.info('Starting DataNode Process');
			await execCmd(dataHost, 'systemctl start influxdb');
			await execCmd(dataHost, 'ps aux | grep -v grep | grep influxdb');
		}

		let dataHostOne = new sshPool.ConnectionPool([clusterBlueprint.username + '@' + clusterBlueprint.hosts[0].ip], {
			'strict': 'false',
			'key': sshKeyFile
		});

		for (let i = 0; i < clusterBlueprint.hosts.length; i++) {
			let host = clusterBlueprint.hosts[i];
			log.info('Adding DataNode ' + host.hostname + ' to cluster');
			await execCmd(dataHostOne, 'influxd-ctl add-data ' + host.hostname + ':8088');
		}

		await execCmd(dataHostOne, 'influxd-ctl show');

	} catch (err) {
		log.error(err);
		throw new Error(err);
	}

}

/************************************************
 * Loadbalancer Installation
 *************************************************/
async function lbInstall() {

}

/************************************************
 * Kapacitor Installation
 *
 * wget https://dl.influxdata.com/kapacitor/releases/kapacitor-1.2.0.x86_64.rpm
 * sudo yum localinstall -y kapacitor-1.2.0.x86_64.rpm
 *
 * wget https://dl.influxdata.com/kapacitor/releases/kapacitor_1.2.0_amd64.deb
 * sudo dpkg -i kapacitor_1.2.0_amd64.deb
 *
 * Setup Config
 * systemctl start kapacitor
 *************************************************/
async function kapInstall() {

}

/************************************************
 * Chronograf Installation
 *
 * wget https://dl.influxdata.com/chronograf/releases/chronograf-1.3.0.x86_64.rpm
 * sudo yum localinstall chronograf-1.3.0.x86_64.rpm
 *
 * wget https://dl.influxdata.com/chronograf/releases/chronograf_1.3.0_amd64.deb
 * sudo dpkg -i chronograf_1.3.0_amd64.deb
 *
 * Setup Config
 * sudo systemctl start chronograf
 *************************************************/
async function chronoInstall() {

}

/************************************************
 *	UTILITY FUNCITONS
 ************************************************/

/**
 * [execCmdS description]
 * @param  {[type]} cmdList [description]
 * @return {[type]}         [description]
 */
async function execCmdS(connectionPool, cmdList) {
	try {
		let response;
		for (let i = 0; i < cmdList.length; i++) {
			log.warn('\n*************************\nRunning ' + cmdList[i] + ' on all hosts\n*************************\n');
			response = await connectionPool.run(cmdList[i]);
			_.each(response, async function (result, idx) {
				log.info('\n' + connectionPool.connections[idx].remote.host + '\n*************************\n' + result.stdout);
			});
		}
	} catch (err) {
		log.error(err);
		throw new Error(err);
	}
}

/**
 * [execCmd description]
 * @param  {[type]} cmd [description]
 * @return {[type]}     [description]
 */
async function execCmd(connectionPool, cmd) {
	try {
		let response;
		log.warn('\n*************************\nRunning ' + cmd + ' on all hosts\n*************************\n');
		response = await connectionPool.run(cmd);
		for (let i = 0; i < response.length; i++) {
			log.info('\n*************************\n' + connectionPool.connections[i].remote.host + '\n*************************\n' + response[i].stdout);
		}
		return;
	} catch (err) {
		log.error(err);
		throw new Error(err);
	}

}

/**
 * [copyFiles description]
 * @param  {[type]} connectionPool [description]
 * @param  {[type]} srcFile        [description]
 * @param  {[type]} destFile       [description]
 * @return {[type]}                [description]
 */
async function copyFiles(connectionPool, srcFile, destFile) {
	try {
		let response;
		log.warn('\n*************************\nCopying File:\n ' + srcFile + ' \nto hosts\n*************************\n');
		response = await connectionPool.copy(srcFile, destFile);
		for (let i = 0; i < response.length; i++) {
			log.info('DONE WITH COPY');
		}
	} catch (err) {
		log.error(err);
		throw new Error(err);
	}
}

clusterPrep();
