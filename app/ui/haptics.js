// Short vibrations for the Visual Impairment profile: one pulse when a turn
// is coming up, two for a floor change, three long ones on arrival.
//
// navigator.vibrate works in Android browsers. iPhones (Safari and every
// iOS browser) do not support it, so this only adds to the spoken and
// on-screen guidance and never replaces it.
// Works in the browser (CampusHaptics) and in Node tests.
(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusHaptics = api;
})(typeof self !== 'undefined' ? self : this, function(root){

  const PATTERNS = {
    turn:[200],
    floor:[150, 100, 150],
    arrive:[300, 150, 300, 150, 300]
  };

  function supported(){
    const nav = root && root.navigator;
    return Boolean(nav && typeof nav.vibrate === 'function');
  }

  function vibrate(kind){
    if(!supported() || !PATTERNS[kind]) return false;
    try{
      return root.navigator.vibrate(PATTERNS[kind]) !== false;
    }catch(error){
      return false;
    }
  }

  return {
    PATTERNS,
    supported,
    turn:() => vibrate('turn'),
    floor:() => vibrate('floor'),
    arrive:() => vibrate('arrive')
  };
});
