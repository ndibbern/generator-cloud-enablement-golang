/*
 Copyright 2017 IBM Corp.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

'use strict';

const Generator = require('yeoman-generator');
let _ = require('lodash');
const Handlebars = require('../lib/handlebars.js');
const Utils = require('../lib/utils');

// suffix for other deployment
const DEPLOYMENT_SUFFIX = '.deploy.yaml';

// list of supporting services
const supportingServicesTypes = ['mongodb'];

// storage directory
const SERVICE_DIR = 'services/';

const portDefault = {
	java: {
		http: '9080',
		https: '9443'
	},
	spring: {
		http: '8080'
	},
	node: {
		http: '3000'
	},
	python: {
		http: '3000'
	},
	swift: {
		http: '8080'
	},
	django: {
		http: '3000'
	}
}

module.exports = class extends Generator {

	constructor(args, opts) {
		super(args, opts);

		// opts -> this.options via Yeoman Generator (super)

		if (typeof (this.options.bluemix) === 'string') {
			this.bluemix = JSON.parse(this.options.bluemix || '{}');
		} else {
			this.bluemix = this.options.bluemix;
		}

		if (typeof(this.options.services) === 'string') {
			this.options.services  = JSON.parse(this.options.services || '[]');
		} else {
			this.options.services = this.options.services || [];
		}
	}


	initializing() {
		this.fileLocations = {
			chart: {source : 'Chart.yaml', target : 'chartDir/Chart.yaml', process: true},
			deployment: {source : 'deployment.yaml', target : 'chartDir/templates/deployment.yaml', process: true},
			service: {source : 'service.yaml', target : 'chartDir/templates/service.yaml', process: true},
			hpa: {source : 'hpa.yaml', target : 'chartDir/templates/hpa.yaml', process: true},
			istio: {source : 'istio.yaml', target : 'chartDir/templates/istio.yaml', process: true},
			basedeployment: {source : 'basedeployment.yaml', target : 'chartDir/templates/basedeployment.yaml', process: true},
			values: {source : 'values.yaml', target : 'chartDir/values.yaml', process: true},
			bindings: {source : 'bindings.yaml', target : 'chartDir/bindings.yaml', process: true}
		};
	}

	configuring() {
		// work out app name and language
		this.options.language = _.toLower(this.bluemix.backendPlatform);

		this.options.helm = {
			prometheus: true,
			istio: false,
			strategy: true,
			liveness: true,
			readiness: false
		};

		this.options.healthEndpoint = this.options.healthEndpoint | 'health';

		if(this.options.language === 'java' || this.options.language === 'spring') {
			this.options.applicationName = this.options.appName || Utils.sanitizeAlphaNum(this.bluemix.name);

			this.options.helm.prometheus = false;
			this.options.helm.istio = true;
			this.options.helm.strategy = false;
			this.options.helm.liveness = false;
			this.options.helm.readiness = true;

			this.options.readinessEndpoint = `${this.options.helm.healthEndpoint}`;
			if ( this.options.language === 'java' &&  this.options.useContextRoot ) {
				this.options.readinessEndpoint = `${this.options.applicationName}${this.options.helm.readinessEndpoint}`
			}
		} else {
			this.options.applicationName = Utils.sanitizeAlphaNum(this.bluemix.name);
		}

		this.options.chartName = Utils.sanitizeAlphaNumLowerCase(this.options.applicationName);

		this.options.servicePorts = {};

		//use port if passed in
		if(this.options.port) {
			this.options.servicePorts.http = this.options.port;
		} else {
			this.options.servicePorts.http = portDefault[this.options.language].http;
		}

		//use https port if passed in
		if(this.options.httpsPort) {
			this.options.servicePorts.http = this.options.httpsPort;
		} else if(portDefault[this.options.language].https) {
			this.options.servicePorts.https = portDefault[this.options.language].https;
		}

		this.options.repositoryURL='';
		if (this.bluemix.server) {
			const registryNamespace = this.bluemix.server.cloudDeploymentOptions && this.bluemix.server.cloudDeploymentOptions.imageRegistryNamespace ?
				this.bluemix.server.cloudDeploymentOptions.imageRegistryNamespace : 'replace-me-namespace';
			const domain = this.bluemix.server.domain ? this.bluemix.server.domain : 'ng.bluemix.net';
			this.options.repositoryURL= `registry.${domain}/${registryNamespace}/`;
			this.options.kubeClusterNamespace =
				this.bluemix.server.cloudDeploymentOptions && this.bluemix.server.cloudDeploymentOptions.kubeClusterNamespace ?
					this.bluemix.server.cloudDeploymentOptions.kubeClusterNamespace : 'default';
		} else {
			// TODO(gib): we seem to be hitting this, not sure how.

			// if --bluemix specified and dockerRegistry is not
			if (this.bluemix.dockerRegistry === undefined) {
				this.options.repositoryURL= 'registry.ng.bluemix.net/replace-me-namespace/';
			}
			else {
				// dockerRegistry was passed in --bluemix or was
				// set via prompt response
				this.options.repositoryURL = this.bluemix.dockerRegistry + '/';
			}
		}
	}

	writing() {
		//skip writing files if platforms is specified via options and it doesn't include kube
		if(this.options.platforms && !this.options.platforms.includes('kube')) {
			return;
		}

		// setup output directory name for helm chart
		// chart/<applicationName>/...
		let chartDir = 'chart/' + this.options.chartName;

		// Jenkinsfile used also by Microclimate

		if (this.options.language === 'node') {
			this.fileLocations.jenkinsfile = {
				source : 'node/Jenkinsfile',
				target : 'Jenkinsfile',
				process : true
			}
		}

		if (this.options.language === 'swift') {
			this.fileLocations.jenkinsfile = {
				source : 'swift/Jenkinsfile',
				target : 'Jenkinsfile',
				process : true
			}
		}

		if (this.options.language === 'java' || this.options.language === 'spring') {
			this.fileLocations.values.source = 'java/values.yaml';
			this.fileLocations.jenkinsfile = {
				source : 'java/Jenkinsfile',
				target : 'Jenkinsfile',
				process : true
			};
		}

		// iterate over file names
		let files = Object.keys(this.fileLocations);
		files.forEach(file => {
			let source = this.fileLocations[file].source;
			let target = this.fileLocations[file].target;
			if(target.startsWith('chartDir')) {
				target = chartDir + target.slice('chartDir'.length);
			}
			if(this.fileLocations[file].process) {
				this._writeHandlebarsFile(source, target, this.options);
			} else {
				this.fs.copy(
					this.templatePath(source),
					this.destinationPath(target)
				);
			}
		});

		if(this.options.services){
			this.options.services.forEach(service => {
				const uniqueServiceSuffix = `${service}-${Utils.createUniqueName(this.bluemix.name)}`;
				if(_.includes(supportingServicesTypes, service)){
					this.fs.copyTpl(
						this.templatePath(SERVICE_DIR + service + DEPLOYMENT_SUFFIX),
						this.destinationPath(chartDir + '/templates/' + service + DEPLOYMENT_SUFFIX), {uniqueServiceSuffix});
				} else {
					console.error(service + ' is not supported');
				}
			})
		}
	}

	_writeHandlebarsFile(templateFile, destinationFile, data) {
		let template = this.fs.read(this.templatePath(templateFile));
		let compiledTemplate = Handlebars.compile(template);
		let output = compiledTemplate(data);
		this.fs.write(this.destinationPath(destinationFile), output);
	}
};
