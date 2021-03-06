import Service, { inject as service } from '@ember/service';
import Util from 'shared/utils/util';
import { get, set } from '@ember/object';
import C from 'shared/utils/constants';

export default Service.extend({
  access:      service(),
  cookies  :   service(),
  session  :   service(),
  globalStore: service(),
  app:         service(),

  generateState() {

    let state = Math.random()+'';

    set(this, 'session.githubState', state);

    return state;
  },

  stateMatches(actual) {

    const expected = get(this, 'session.githubState');

    return actual && expected === actual;
  },

  testConfig(config) {
    return config.doAction('configureTest', config);
  },

  saveConfig(config, opt) {
    return config.doAction('testAndApply', opt);
  },

  authorize(auth, state) {

    var url = Util.addQueryParams(get(auth, 'redirectUrl'), {
      scope:        'read:org',
      redirect_uri: `${window.location.origin}/verify-auth`,
      authProvider: 'github',
      state:        state,
    });

    return window.location.href = url;
  },

  login() {

    const provider     = get(this, 'access.providers').findBy('id', 'github');
    const authRedirect = get(provider, 'redirectUrl');
    const redirect     = Util.addQueryParams(`${window.location.origin}/verify-auth`, {
      login: true,
      state: this.generateState(),
    });

    const url = Util.addQueryParams(authRedirect, {
      scope:        'read:org',
      redirect_uri: redirect,
    });

    window.location.href = url;
  },

  test(config, cb) {
    let responded = false;

    window.onGithubTest = (err,code) => {

      if ( !responded ) {

        let ghConfig = config;

        responded = true;

        this.finishTest(ghConfig, code, cb);

      }

    };

    set(this, 'state', this.generateState());

    let url = Util.addQueryParams(`${window.location.origin}/verify-auth`, {
        config: 'github',
    });

    let popup = window.open(url, 'rancherAuth', Util.popupWindowOptions());

    let timer = setInterval(function() {

      if ( !popup || popup.closed ) {

        clearInterval(timer);

        if( !responded ) {

          responded = true;

          cb({type: 'error', message: 'Github access was not authorized'});

        }

      }

    }, 500);
  },

  finishTest(config, code, cb) {

    let ghConfig = config;

    set(ghConfig, 'enabled', true);

    let out = {
      code:         code,
      enabled:      true,
      githubConfig: ghConfig,
      description:  C.SESSION.DESCRIPTION,
      ttl:          C.SESSION.TTL,
    };

    return this.saveConfig(config, out).then(() => {

      return get(this, 'globalStore').find('principal', null, {filter: {me: true, provider: 'github'}}).then(( resp ) => {

        let me = resp.find( p => {
          return get(p, 'me') && get(p, 'provider') === 'github';// TODO  filters do not work but craig knows
        });

        out.githubConfig.allowedPrincipalIds.push(me.id);

        return ghConfig.save().then(() => {
          window.location.href = window.location.href;
        });

      });

    }).catch(err => {
      cb(err);
    });
  },
});
