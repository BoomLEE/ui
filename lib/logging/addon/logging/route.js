import Route from '@ember/routing/route';
import { next } from '@ember/runloop';
import { inject as service } from "@ember/service";
import { get } from '@ember/object'
import { alias } from '@ember/object/computed';
import { hash } from 'rsvp';

export default Route.extend({
  globalStore: service(),
  scope: service(),
  pageScope: alias('scope.currentPageScope'),
  cluster: alias('scope.currentCluster'),
  project: alias('scope.currentProject'),

  createLogging(loggingType) {
    const gs = get(this, 'globalStore');
    const newLogging = gs.createRecord({
      type: loggingType,
      outputTags: {},
    });
    return newLogging;
  },

  actions: {
    refreshModel() {
      this.refresh();
    }
  },

  model(/*params, transition*/) {
    const globalStore = this.get('globalStore');
    const pageScope = this.get('pageScope');
    const cluster = window.l('route:application').modelFor('authenticated.cluster');
    if (pageScope === 'cluster') {
      const clusterId = cluster.get('id');
      const opt = {
        filter: {
          clusterId,
        },
      };
      return globalStore.findAll('clusterlogging', opt).then(loggings => {
        let logging = loggings.filterBy('clusterId', clusterId).get('firstObject');
        if (!logging) {
          logging = this.createLogging('clusterlogging');
        }
        const clone = logging.clone().patch();
        return {
          logging: clone,
          originalLogging: logging,
        };
      });
    } else if (pageScope === 'project') {
      const project = window.l('route:application').modelFor('authenticated.project').get('project');
      const projectId = project.get('id');
      const clusterId = project.get('clusterId');
      const clusterOpt = {
        filter: {
          clusterId,
        },
      };
      const projectOpt = {
        filter: {
          projectId,
        },
      };
      return hash({
        clusterLoggings: globalStore.findAll('clusterlogging', clusterOpt),
        projectLoggings: globalStore.findAll('projectlogging', projectOpt),
      }).then(hash => {
        let logging = hash.projectLoggings.filterBy('projectId', projectId).get('firstObject');
        if (!logging) {
          logging = this.createLogging('projectlogging');
        }
        const clone = logging.clone().patch();
        const clusterLogging = hash.clusterLoggings.filterBy('clusterId', clusterId).get('firstObject');
        return {
          logging: clone,
          originalLogging: logging,
          clusterLogging,
        };
      });
    }
  },
  setupController(controller, model) {
    this._super(...arguments);
    const t = get(model, 'originalLogging.targetType');
    next(() => {
      controller.set('targetType', t);
    });
  },
});
