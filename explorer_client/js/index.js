import $ from 'jquery';

import 'bootstrap';
import 'd3';
import 'jquery-ui';
import 'epoch-charting-ie-patched';
import moment from 'moment';

import 'jif-dashboard/dashboard-core'
import 'jif-dashboard/dashboard-util'
import 'jif-dashboard/dashboard-template'

// import this first because it sets a global all the rest of the widgets need
import './widgets/widget-root';

import common from './common';

import './vendor/stomp.min'
import './vendor/client'
import utils from './utils';

window.utils = utils;
window.moment = moment;


window.Tower = {
	ready: false,
	current: null,
	status: {},

	// Tower Control becomes ready only after the first status is received from the server
	isReady: function() {
		Tower.ready = true;

		// let everyone listening in know
		Dashboard.Utils.emit('tower-control|ready|true');

		return true;
	},


	init: function() {
		//set options for the Dashboard
		Dashboard.setOptions({
			'appName': 'onechain fabricexplorer'
		});

        Dashboard.preregisterWidgets({

            'chaincodelist'		: require('./widgets/chaincodelist'),
            // 'metrix_choc_tx'	: require('./widgets/metrix_choc_tx'),
            'metrix_block_min'	: require('./widgets/metrix_block_min'),
            'metrix_txn_sec'	: require('./widgets/metrix_txn_sec'),
            'metrix_txn_min'	: require('./widgets/metrix_txn_min'),
            'peerlist'			: require('./widgets/peerlist'),
            'blockview'			: require('./widgets/blockview'),
            'blocklist'			: require('./widgets/blocklist'),
            'blockinfo'			: require('./widgets/blockinfo'),
            'txdetail'			: require('./widgets/txdetail'),

        });

		//initialize the Dashboard, set up widget container
		Dashboard.init()

        // Adding event for hash changes
        $(window).on('hashchange', this.processHash);

        this.processHash();

        // Reusing socket from cakeshop.js
        Tower.stomp = Client.stomp;
        Tower.stomp_subscriptions = Client._stomp_subscriptions;

		//open first section - channel
		Tower.section['default']();
	},

    processHash: function() {
        if (window.location.hash) {
            const params = {};
            const hash = window.location.hash.substring(1, window.location.hash.length);

            _.each(hash.split('&'), function(pair) {
                pair = pair.split('=');
                params[pair[0]] = decodeURIComponent(pair[1]);
            });

            var werk = function() {
                if (params.section) {
                    $('#' + params.section).click();
                }

                if (params.data) {
                    try {
                        params.data = JSON.parse(params.data);
                    } catch (err) {}
                }

                if (params.widgetId) {
                    Dashboard.show({
                        widgetId: params.widgetId,
                        section: params.section ? params.section : Tower.current,
                        data: params.data, refetch: true,
                    });
                }
            };

            // do when ready
            if (!Tower.ready) {
                Dashboard.Utils.on(function(ev, action) {
                    if (action.indexOf('tower-control|ready|') === 0) {
                        werk();
                    }
                });
            } else {
                werk();
            }
        }
    },

	//define the sections
	section: {

		'default':function () {
            var statusUpdate = function(response) {
                var status = response;

                utils.prettyUpdate(Tower.status.peerCount, status.peerCount, $('#default-peers'));
                utils.prettyUpdate(Tower.status.latestBlock, status.latestBlock, $('#default-blocks'));
                utils.prettyUpdate(Tower.status.txCount, status.txCount, $('#default-txn'));
                utils.prettyUpdate(Tower.status.chaincodeCount, status.chaincodeCount, $('#default-chaincode'));

                Tower.status = status;

                // Tower Control becomes ready only after the first status is received from the server
                if (!Tower.ready) {
                    Tower.isReady();
                }

                Dashboard.Utils.emit('node-status|announce');
            };

            $.ajax({
                type: "post",
                url: "api/status/get",
                cache:false,
                async:false,
                dataType: "json",
                success: function(response){
                    statusUpdate(response);
                },
				error:function(err){
                    statusUpdate({
                        peerCount: 'n/a',
                        latestBlock: 'n/a',
                        txCount: 'n/a',
                        chaincodeCount: 'n/a'
                    });
				}

            });
            utils.subscribe('/topic/metrics/status', statusUpdate);

		},

		'channel': function() {
			// data that the widgets will use
			var data = {
				'numUser': 4,
				'appName': 'sample app',
				'url': 'hello.com',
				'description': 'this is a description of the app.'
			}

			// the array of widgets that belong to the section,
			// these were preregistered in init() because they are unique

			var widgets = [

				{ widgetId: 'blockinfo',data: {a:'ddd',b:'bbb'}},
				{ widgetId: 'blocklist' ,data: Tower.status.latestBlock},
				{ widgetId: 'blockview' ,data: data},
				{ widgetId: 'txdetail'  ,data: data},
				{ widgetId: 'peerlist'  ,data: data},
				{ widgetId: 'metrix_txn_sec' ,data: data},
				{ widgetId: 'metrix_txn_min' ,data: data},
				{ widgetId: 'metrix_block_min' ,data: data},
				// { widgetId: 'metrix_choc_tx' ,data: data},
				{ widgetId: 'chaincodelist' ,data: data},

				/*{ widgetId: 'misc' },
				{ widgetId: 'lab' },
				{ widgetId: 'date' },
				{ widgetId: 'controls' },
				{ widgetId: 'weather' },
				{ widgetId: 'info' , data: data}, //data can be passed in
				{ widgetId: 'form' },*/

			];

			// opens the section and pass in the widgets that it needs
			Dashboard.showSection('peers', widgets);
		},

		// a section using same widget template for multiple widgets
		'user': function() {

			// define the data
			var userlist = {
				'user1': {
					'name'	: 'Admin',
					'role'	: 'admin',
					'id'	: 123
				},
				'user2': {
					'name'	: 'Developer',
					'role'	: 'developer',
					'id'	: 456
				},
				'user3': {
					'name'	: 'Data Scientist',
					'role'	: 'data scientist',
					'id'	: 789
				},
				'user4': {
					'name'	: 'QA',
					'role'	: 'qa',
					'id'	: 101
				}
			}

			var widgets = [];
			//iterate over the data, creating a new widget for each item
			_.each(userlist, function(user, key) {
				var widget = {};
				widget[key + '-user'] = require('./widgets/user.js');
				Dashboard.preregisterWidgets(widget);

				widgets = widgets.concat([{
					widgetId: key + '-user',
					data: user
				}])
			})

			Dashboard.showSection('channels', widgets);
		}
	},


	debug: function(message) {
		var _ref;
		return typeof window !== 'undefined' && window !== null ? (_ref = window.console) !== null ? _ref.log(message) : void 0 : void 0;
	}
};



$(function() {
	$(window).on('scroll', function(e) {
		if ($(window).scrollTop() > 50) {
			$('body').addClass('sticky');
		} else {
			$('body').removeClass('sticky');
		}
	});

	// logo handler
	$("a.tower-logo").click(function(e) {
		e.preventDefault();
		$("#channel").click();
	});

	// Menu (burger) handler
	$('.tower-toggle-btn').on('click', function() {
		$('.tower-logo-container').toggleClass('tower-nav-min');
		$('.tower-sidebar').toggleClass('tower-nav-min');
		$('.tower-body-wrapper').toggleClass('tower-nav-min');
	});


	$('#reset').on('click', function() {
		Dashboard.reset();
	})


	// Navigation menu handler
	$('.tower-sidebar li').click(function(e) {
		var id = $(this).attr('id');

		e.preventDefault();

		Tower.current = id;

		$('.tower-sidebar li').removeClass('active');
		$(this).addClass('active');

		Tower.section[Tower.current]();

		$('.tower-page-title').html( $('<span>', { html: $(this).find('.tower-sidebar-item').html() }) );

	});

	// ---------- INIT -----------
	Tower.init();

	// Setting 'peers' as first section
	$('.tower-sidebar li').first().click();
});