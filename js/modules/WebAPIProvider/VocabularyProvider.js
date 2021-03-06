define(function (require, exports) {

	var $ = require('jquery');
	var config = require('appConfig');
	var sourceAPI = require('webapi/SourceAPI');
	var sharedState = require('atlas-state');

	var loadedPromise = $.Deferred();
	loadedPromise.resolve();

	var defaultSource;
	var domainPromise = $.Deferred();
	var domains = [];

	sourceAPI.getSources().then(function (sources) {
		// find the source which has a Vocabulary Daimon with priority = 1
		var prioritySources = sources.filter(function (source) {
			return source.daimons.filter(function (daimon) {
				return daimon.daimonType == "Vocabulary" && daimon.priority == "1"
			}).length > 0
		});
		if (prioritySources.length > 0)
			defaultSource = prioritySources[0];
		else // find the first vocabulary or CDM daimon
			defaultSource = sources.filter(function (source) {
			return source.daimons.filter(function (daimon) {
				return daimon.daimonType == "Vocabulary" || daimon.daimonType == "CDM"
			}).length > 0
		})[0];

		// preload domain list once for all future calls to getDomains()
		$.ajax({
			url: config.webAPIRoot + 'vocabulary/' + defaultSource.sourceKey + '/domains',
		}).then(function (results) {
			$.each(results, function (i, v) {
				domains.push(v.DOMAIN_ID);
			});
			domainPromise.resolve(domains);
		});
	})

	function loadDensity(results) {
		var densityPromise = $.Deferred();

		if (results.length == 0) {
			densityPromise.resolve();
			return densityPromise;
		}
		var searchResultIdentifiers = [];
		for (c = 0; c < results.length; c++) {
			// optimization - only lookup standard concepts as non standard concepts will not have records
			if (results[c].STANDARD_CONCEPT_CAPTION == 'Standard' || results[c].STANDARD_CONCEPT_CAPTION == 'Classification') {
				searchResultIdentifiers.push(results[c].CONCEPT_ID);
			}
		}
		var densityIndex = {};
		$.ajax({
			url: sharedState.resultsUrl() + 'conceptRecordCount',
			method: 'POST',
			contentType: 'application/json',
			timeout: 10000,
			data: JSON.stringify(searchResultIdentifiers),
			success: function (entries) {
				var formatComma = d3.format(',');
				for (var e = 0; e < entries.length; e++) {
					densityIndex[entries[e].key] = entries[e].value;
				}
				for (var c = 0; c < results.length; c++) {
					var concept = results[c];
					if (densityIndex[concept.CONCEPT_ID] != undefined) {
						concept.RECORD_COUNT = formatComma(densityIndex[concept.CONCEPT_ID][0]);
						concept.DESCENDANT_RECORD_COUNT = formatComma(densityIndex[concept.CONCEPT_ID][1]);
					} else {
						concept.RECORD_COUNT = 0;
						concept.DESCENDANT_RECORD_COUNT = 0;
					}
				}
				densityPromise.resolve();
			},
			error: function (error) {
				for (var c = 0; c < results.length; c++) {
					var concept = results[c];
					concept.RECORD_COUNT = 'timeout';
					concept.DESCENDANT_RECORD_COUNT = 'timeout';
				}
				densityPromise.resolve();
			}
		});
		return densityPromise;
	}

	function search(searchString, options) {
		var deferred = $.Deferred();

		var search = {
			QUERY: searchString,
			DOMAIN_ID: options.domains,
			INVALID_REASON: 'V'
		}

		$.ajax({
			url: config.webAPIRoot + 'vocabulary/' + defaultSource.sourceKey + '/search',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify(search),
			success: function (results) {
				deferred.resolve(results)
			}
		});

		return deferred.promise();
	}

	function getDomains() {
		// this is initliazed once for all calls
		return domainPromise;
	}

	function getConcept(id) {
		var getConceptPromise = $.ajax({
			url: config.webAPIRoot + 'vocabulary/' + defaultSource.sourceKey + '/concept/' + id
		});

		return getConceptPromise;
	}

	function getConceptSetList(url) {
		var repositoryUrl;

		if (url)
			repositoryUrl = url + 'conceptset/';
		else
			repositoryUrl = config.webAPIRoot + 'conceptset/';

		var getConceptSetListPromise = $.ajax({
			url: repositoryUrl
		});

		return getConceptSetListPromise;
	}

	function getConceptSetExpression(id, url) {
		var repositoryUrl;

		if (url)
			repositoryUrl = url + 'conceptset/';
		else
			repositoryUrl = config.webAPIRoot + 'conceptset/';

		repositoryUrl += id + '/expression';

		var getConceptSetPromise = $.ajax({
			url: repositoryUrl
		});

		return getConceptSetPromise;
	}

	function resolveConceptSetExpression(expression, url, sourceKey) {
		
		var repositoryUrl = (url || config.webAPIRoot) + 'vocabulary/' + (sourceKey || defaultSource.sourceKey) + '/resolveConceptSetExpression';

		var resolveConceptSetExpressionPromise = $.ajax({
			url: repositoryUrl,
			data: JSON.stringify(expression),
			method: 'POST',
			contentType: 'application/json'
		});

		return resolveConceptSetExpressionPromise;
	}

	function getConceptSetExpressionSQL(expression, url, sourceKey) {
		var repositoryUrl = (url || config.webAPIRoot) + 'vocabulary/' + (sourceKey || defaultSource.sourceKey) + '/conceptSetExpressionSQL';

		var conceptSetExpressionSQLPromise = $.ajax({
			url: repositoryUrl,
			data: JSON.stringify(expression),
			method: 'POST',
			contentType: 'application/json'
		});

		return conceptSetExpressionSQLPromise;
	}

	function getConceptsById(identifiers, url, sourceKey) {
		var repositoryUrl = (url || config.webAPIRoot) + 'vocabulary/' + (sourceKey || defaultSource.sourceKey) + '/lookup/identifiers';

		var getConceptsByIdPromise = $.ajax({
			url: repositoryUrl,
			data: JSON.stringify(identifiers),
			method: 'POST',
			contentType: 'application/json'
		});

		return getConceptsByIdPromise;
	}

	function getMappedConceptsById(identifiers, url, sourceKey) {
		var repositoryUrl = (url || config.webAPIRoot) + 'vocabulary/' + (sourceKey || defaultSource.sourceKey) + '/lookup/mapped';

		var getMappedConceptsByIdPromise = $.ajax({
			url: repositoryUrl,
			data: JSON.stringify(identifiers),
			method: 'POST',
			contentType: 'application/json'
		});

		return getMappedConceptsByIdPromise;
	}

	function optimizeConceptSet(conceptSetItems, url, sourceKey) {
		var repositoryUrl = (url || config.webAPIRoot) + 'vocabulary/' + (sourceKey || defaultSource.sourceKey) + '/optimize';

		var getOptimizedConceptSetPromise = $.ajax({
			url: repositoryUrl,
			data: JSON.stringify(conceptSetItems),
			method: 'POST',
			contentType: 'application/json'
		});

		return getOptimizedConceptSetPromise;
	}

	function compareConceptSet(compareTargets, url, sourceKey) {
		var repositoryUrl = (url || config.webAPIRoot) + 'vocabulary/' + (sourceKey || defaultSource.sourceKey) + '/compare';

		var getComparedConceptSetPromise = $.ajax({
			url: repositoryUrl,
			data: JSON.stringify(compareTargets),
			method: 'POST',
			contentType: 'application/json'
		});

		return getComparedConceptSetPromise;
	}

	var api = {
		loaded: loadedPromise,
		search: search,
		getDomains: getDomains,
		getConcept: getConcept,
		getConceptSetList: getConceptSetList,
		getConceptSetExpression: getConceptSetExpression,
		resolveConceptSetExpression: resolveConceptSetExpression,
		getConceptsById: getConceptsById,
		getMappedConceptsById: getMappedConceptsById,
		getConceptSetExpressionSQL: getConceptSetExpressionSQL,
		optimizeConceptSet: optimizeConceptSet,
		compareConceptSet: compareConceptSet,
		loadDensity: loadDensity
	}

	return api;
});