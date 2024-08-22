// # FUNCTIONALITY FOR FURIGANA, NAV, QUICK JISHO, ETC. #
(function (window, document) {
  'use strict';
  
  // primary object for functionality
  var Genki = {
    
    canNotify : 'Notification' in window,
    
    // checks if touchscreen controls
    isTouch : 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0,
    isTouching : false,
    
    // tells us if being used on a local file system so we can append index.html to URLs
    local : window.location.protocol == 'file:' ? 'index.html' : '',
    
    // tells us if debug mode is active
    debug : /debug/.test(window.location.search) ? '?debug' : '',

    // frequently used/generic strings
    lang : {
      // furigana toggle
      toggle_furigana : '<button class="button furigana-toggler" onclick="Genki.toggle.furigana(this);"><i class="fa">&#xf2a8;</i>' + 'Furigana: <span class="furigana-show">OFF</span><span class="furigana-hide">ON</span></button>'
    },

    // info about the currently active page
    active : {
      path : window.location.pathname.replace(/.*?\/lessons.*?\/(.*?\/.*?)\/.*/g, '$1'), // current path
    },

    // scroll to the specified element: Genki.scrollTo('#lesson-3')
    // scrolling can be delayed by passing a value that evaluates to true (true; 1; '.') to the second param; delay
    // the second param is mostly for script generated content, i.e. exercises, since there's a small delay before the content is visible
    scrollTo : function (el, delay) {
      // check if el is a selector
      if (typeof el == 'string') {
        el = document.querySelector(el);
      }

      var scroll = function () {
        document.body.scrollTop = el.offsetTop;
        document.documentElement.scrollTop = el.offsetTop;
      };

      // scroll immediately or wait 100ms
      // the latter is for exercises, where there's a slight delay before content is available
      if (delay) {
        setTimeout(scroll, 100);
      } else {
        scroll();
      }
    },

    
    // functions that toggle the display of elements
    toggle : {
      
      // toggle the quick nav
      quickNav : function (button) {
        button.className = button.className == 'list-open' ? '' : 'list-open';
      },
      
      
      // toggles the display of lists
      list : function (el) {
        var closed = 'lesson-title',
            opened = closed + ' lesson-open';

        el.className = el.className == opened ? closed : opened;

        // close any open lists
        for (var a = el.parentNode.querySelectorAll('.lesson-title'), i = 0, j = a.length; i < j; i++) {
          if (a[i] != el) {
            a[i].className = closed;
          }
        }
      },
      
      
      // toggles furigana 
      furigana : function (button) {
        var zone = document.getElementById('page'),
            state = (storageOK && localStorage.furiganaVisible) || (/helper-hidden/.test(zone.className) ? 'false' : 'true');
        
        // hide or show the textual aids
        switch (state) {
          case 'true' :
            state = 'false';
            zone.className = zone.className.replace('helper-present', 'helper-hidden');
            break;
            
          case 'false' :
            state = 'true';
            zone.className = zone.className.replace('helper-hidden', 'helper-present');
            break;
            
          default :
            break;
        }
        
        // update button html
        Genki.lang.toggle_furigana = button.outerHTML;
        
        // save settings if supported
        if (storageOK) {
          localStorage.furiganaVisible = state;
        }
      }
    },

    
    // functions that create new functionality and adds it to the document
    // usually functions that are executed via init
    create : {


      // creates the quick nav
      quickNav : function () {
        var nav = 
            '<a href="#toggle-navigation" id="toggle-navigation" onclick="Genki.toggle.quickNav(this); return false;" title="Toggle quick navigation"></a>'+
            '<nav id="quick-nav">'+
              '<h3 class="main-title">Quick Navigation</h3>'+
              '<div id="link-list" class="normal-block indent-block">'+
                '<div><a id="link-home" href="' + (getPaths() == '' ? '#main-title' : getPaths()) + '"><i class="fa">' + (getPaths() == '' ? '&#xf062;' : '&#xf015;') + '</i>' + (getPaths() == '' ? 'Top' : 'Home') + '</a></div>'+
                '<div><a id="link-report" href="' + getPaths() + 'report/"><i class="fa">&#xf188;</i>Reports &amp; Feedback</a></div>'+
                '<div><a id="link-download" href="' + getPaths() + 'download/"><i class="fa">&#xf019;</i>Download</a></div>'+
                '<div><a id="link-donate" href="' + getPaths() + 'donate/"><i class="fa">&#xf004;</i>Donate</a></div>'+
                '<div><a id="link-github" href="https://github.com/SethClydesdale/colloquial-kansai-dictionary"><i class="fa">&#xf09b;</i>GitHub</a></div>'+
                '<div><a id="link-settings" href="#genki-site-settings" onclick="GenkiSettings.manager(); return false;"><i class="fa">&#xf013;</i>Settings</a></div>'+
                '<div>' + Genki.lang.toggle_furigana + '</div>'+
              '</div>'+
              '<div id="related-projects" class="indent-block">'+
                '<h3>Related Projects</h3>'+
                '<a href="https://sethclydesdale.github.io/genki-study-resources/lessons-3rd/" title="Genki Study Resources"><img src="' + getPaths() + 'resources/images/genki-img.png" alt="Genki Study Resources"></a>'+
                '<a href="https://sethclydesdale.github.io/tobira-study-resources/" title="Tobira Study Resources"><img src="' + getPaths() + 'resources/images/tobira-img.png" alt="Tobira Study Resources"></a>'+
              '</div>'+
            '</nav>';
        
        // add the quick nav to the document
        document.getElementById('content').insertAdjacentHTML('afterbegin', nav);
      }
    },
    
    
    // quick dictionary functionality
    quickJisho : {
      hidden : true, // display state of dictionary
      selectorHidden : true, // display state of "lookup button"
      tabbing : false, // prevents selection change from occuring while tabbing
      
      // creates the quick dictionary button and popup
      create : function () {
        if (Genki.quickJisho.cache) return; // prevent duplication of the quickJisho
        
        var button = document.createElement('DIV'),
            box = document.createElement('DIV'),
            selector = document.createElement('BUTTON'),
            frag = document.createDocumentFragment();
        
        // button attrs
        button.id = 'quick-jisho-toggle';
        button.innerHTML = '<i class="fa">&#xf02d;</i>';
        button.title = 'Toggle Quick Dictionary'
        button.tabIndex = 0;
        button.onclick = Genki.quickJisho.toggle;
        button.onkeypress = function (e) {
          e.key == 'Enter' && Genki.quickJisho.toggle();
        }
        
        // box attrs
        box.id = 'quick-jisho-window';
        box.className = 'quick-jisho-hidden';
        box.innerHTML = 
          '<h3 id="quick-jisho-title" class="main-title">Quick Dictionary <span id="quick-jisho-hits"></span></h3>'+
          '<div id="quick-jisho-content">'+
            '<div class="quick-jisho-row center">'+
              '<input tabindex="0" id="quick-jisho-search" type="text" placeholder="Search..." oninput="Genki.quickJisho.search(this.value);">'+
            '</div>'+
            '<div class="quick-jisho-row">'+
              '<ul id="quick-jisho-results"></ul>'+
            '</div>'+
          '</div>';
        
        // selection button
        selector.id = 'quick-jisho-selector';
        selector.className = 'button';
        selector.style.display = 'none';
        selector.innerHTML = '<i class="fa">&#xf002;</i>Look up';
        selector.onclick = Genki.quickJisho.lookUp;
        selector.tabIndex = 0;
        
        // add nodes to the document
        frag.appendChild(box);
        frag.appendChild(button);
        frag.appendChild(selector);
        document.body.appendChild(frag);
        var footerRight = document.querySelector('.footer-right');
        footerRight.style.marginRight = '40px'; // offset footer so texts are visible
        
        // node cache
        Genki.quickJisho.cache = {
          box : box,
          search : document.getElementById('quick-jisho-search'),
          results : document.getElementById('quick-jisho-results'),
          hits : document.getElementById('quick-jisho-hits'),
          selector : document.getElementById('quick-jisho-selector')
        };
        
        // selection handler
        document.onselectionchange = Genki.quickJisho.getSelection;
        
        // get mouse position for adjusting x/y values of the selector
        document.onmousemove = function (e) {
          Genki.quickJisho.x = Math.abs(e.pageX - document.body.clientWidth) < 100 ? e.pageX - 95 : e.pageX;
          Genki.quickJisho.y = Math.abs(e.pageY - document.body.clientHeight) < 40 ? e.pageY - 32 : e.pageY + 12;
        };
        
        // key handler for focusing the dictionary lookup button with a tab press
        document.onkeydown = function (e) {
          if (e.key == 'Tab' && !Genki.quickJisho.selectorHidden && document.activeElement != Genki.quickJisho.cache.selector) {
            Genki.quickJisho.tabbing = true;
            Genki.quickJisho.cache.selector.focus();
            e.preventDefault();
          }
        };
      },
      
      
      // toggles the quick dictionary
      toggle : function () {
        // load in the dictionary definitions
        if (!Genki.jisho && !Genki.quickJisho.loading) {
          Genki.quickJisho.loading = true;
          
          var jisho = document.createElement('SCRIPT');
          jisho.src = getPaths() + 'resources/javascript/jisho.min.js';
          jisho.onload = function () {
            if (Genki.quickJisho.cache.search.value) {
              Genki.quickJisho.search(Genki.quickJisho.cache.search.value);
            }
            
            Genki.quickJisho.loading = false;
          };
          
          document.body.appendChild(jisho);
        }
        
        
        // toggle dictionary display
        if (Genki.quickJisho.hidden) {
          Genki.quickJisho.cache.box.className = '';
          Genki.quickJisho.hidden = false;
          Genki.quickJisho.cache.search.focus();
          
        } else {
          Genki.quickJisho.cache.box.className = 'quick-jisho-hidden';
          Genki.quickJisho.hidden = true;
        }
      },
      
      
      // searches the dictionary
      search : function (value, retry) {
        // clear existing timeout
        if (Genki.quickJisho.searchTimeout) {
          window.clearTimeout(Genki.quickJisho.searchTimeout);
        }
        
        // wait 300ms before submitting search, just in case the user is still typing
        Genki.quickJisho.searchTimeout = window.setTimeout(function() {
          var results = '',
              hits = 0,
              k, i, j, l, ja;
          
          Genki.quickJisho.cache.results.innerHTML = '';
          
          if (value) {
            value = value.toLowerCase();
            
            for (k in Genki.jisho) {
              for (i = 0, j = Genki.jisho[k].length; i < j; i++) {
                for (l in Genki.jisho[k][i]) {
                  if (Genki.jisho[k][i][l].toLowerCase().indexOf(value) != -1) {
                    ja = Genki.jisho[k][i].ja.split('|');

                    results += '<li tabindex="0" class="definition clear">'+
                      '<span class="def-ja' + (ja[1] ? ' def-furi' : '') + '">'+
                        ja[0]+
                        (ja[1] ? '<i>' + ja[1] + '</i>' : '')+
                      '</span>'+
                      '<span class="def-en">' + Genki.jisho[k][i].en + '</span>'+
                      (Genki.jisho[k][i].v ? ' <span class="def-vtype">[<i>' + Genki.jisho[k][i].v + '</i>]</span>' : '')+
                      '<span class="def-label">' + Genki.jisho[k][i].l + '</span>';
                    '</li>';

                    hits++;
                    break;
                  }
                }
              }
            }
          }
          
          // perform a kanji only search if the previous one yeilded no results
          if (!retry && !results && value && /[\u3400-\u9faf]/.test(value)) {
            var kanji = value.match(/[\u3400-\u9faf]+/);
            
            if (kanji && kanji[0]) {
              Genki.quickJisho.search(kanji[0], true);
            }
          } 
          
          // show results
          else {
            Genki.quickJisho.cache.results.innerHTML = results ? results : value ? '<li>No results found for "' + value + '".</li>' : '';
            Genki.quickJisho.cache.hits.innerHTML = hits ? '(' + hits + ')' : '';
          }
          
          delete Genki.quickJisho.searchTimeout;
        }, 300);
      },
      
      
      // look up a selected word
      lookUp : function () {
        if (Genki.quickJisho.hidden) {
          Genki.quickJisho.toggle();
        }

        Genki.quickJisho.cache.search.value = ''.trim ? Genki.quickJisho.selectedText.trim() : Genki.quickJisho.selectedText;
        Genki.quickJisho.search(Genki.quickJisho.cache.search.value);

        // hide the selector search
        this.style.display = 'none';
        Genki.quickJisho.selectorHidden = true;
      },
      
      
      // gets the selected text and shows the look up button
      getSelection : function () {
        // disables quick jisho look up if preferred
        if (storageOK && localStorage.genkiJishoLookUp == 'false') return false;
        
        // returns if tabbing to the lookup button
        // required, as some browsers change selection when focusing a new element w/focus()
        if (Genki.quickJisho.tabbing) {
          // delay setting "tabbing" to false, as the selection change tends to proc twice for focus changes
          if (!Genki.quickJisho.tabbingOff) { // prevent duplication of timeout
            Genki.quickJisho.tabbingOff = setTimeout(function () {
              Genki.quickJisho.tabbing = false;
              delete Genki.quickJisho.tabbingOff;
            }, 10);
          }
          
          return false;
        }
        
        // get the currently selected texts
        if (document.getSelection) {
          var selection = document.getSelection();

          if (selection.type == 'Range' && selection.toString && !/quick-jisho/.test(selection.focusNode.className)) {
            // stores selected text for searches
            Genki.quickJisho.selectedText = selection.toString();
            
            // update lookup button position
            Genki.quickJisho.cache.selector.style.left = Genki.quickJisho.x + 'px';
            Genki.quickJisho.cache.selector.style.top = Genki.quickJisho.y + 'px';
            
            // show lookup button
            if (Genki.quickJisho.selectorHidden) {
              Genki.quickJisho.cache.selector.style.display = '';
              Genki.quickJisho.selectorHidden = false;
            }

          } else { // hide lookup button and clear selection
            Genki.quickJisho.selectedText = '';

            if (!Genki.quickJisho.selectorHidden) {
              Genki.quickJisho.cache.selector.style.display = 'none';
              Genki.quickJisho.selectorHidden = true;
            }
          }
        }
      }
    },
    
    
    // initial setup for functionality
    init : function () {
      Genki.create.quickNav();
      
      // touch listeners for touch screen events
      if (Genki.isTouch) {
        document.ontouchstart = function () {
          Genki.isTouching = true;
        }
        
        document.ontouchend = function () {
          Genki.isTouching = false;
        }
        
        document.ontouchcancel = function () {
          Genki.isTouching = false;
        }
      }
      
      // define Genki in the global namespace
      window.Genki = this;
    }
    
  };
  
  
  // initial setup
  Genki.init();
}(window, document));