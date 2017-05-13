'use strict';
const url = require('url');
const path = require('path');

const BASE_REPO_URL = 'https://dl.influxdata.com/';
const INFLUX_ENT_VERSION = '1.2.1';
const CONFIG = {
	clusterBlueprintFile: 'conf/cluster.json',
	libDir: path.resolve(__dirname, 'lib'),
	appDir: path.resolve(process.cwd(), 'app'),
	tmpDir: 'tmp',
	logger: {
		logLevel: 'DEBUG',
		dateFormat: 'HH:mm:ss.SSS'
	},
	ntpSync: 'time-b.nist.gov time-c.nist.gov',
	deps: 'wget ntp',
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
};

module.exports = CONFIG;
