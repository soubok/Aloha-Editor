(function (aloha) {
	'use strict';
	
	var Dom = aloha.dom;
	var Arrays = aloha.arrays;
	var Boundaries = aloha.boundaries;
	var Editing = aloha.editing;
	var Blocks = aloha.blocks;
	var DragDrop aloha.dragDrop;
	var Editables = aloha.editables;
	var Keys = aloha.keys;
	var Mouse = aloha.mouse;
	var Paste = aloha.paste;
	var Selections = aloha.selections;
	var Typing = aloha.typing;

	var CLASS_PREFIX = 'aloha-action-';

	/**
	 * Executes an action object as generated by parseAction() which looks like
	 * one of the following:
	 *
	 * {
	 *    format : true, // it's an action to format something
	 *    node   : 'b'   // as <b>
	 * }
	 *
	 * or even a compound of operations ...
	 *
	 * {
	 *    format     : true,
	 *    node       : 'b',
	 *    style      : true,
	 *    styleName  : 'background',
	 *    styleValue : 'red'
	 * }
	 *
	 * @private
	 * @param  {!Object.<string, ?>} action
	 * @param  {!Array.<Boundary>}   boundaries
	 * @return {Array.<Boundaries>}
	 */
	function execute(action, boundaries) {
		if (action.format) {
			boundaries = Editing.format(
				boundaries[0],
				boundaries[1],
				action.format
			);
		}
		if (action.style) {
			boundaries = Editing.style(
				boundaries[0],
				boundaries[1],
				action.styleName,
				action.styleValue
			);
		}
		if (action.classes) {
			boundaries = Editing.className(
				boundaries[0],
				boundaries[1],
				action.className
			);
		}
		return boundaries;
	}

	/**
	 * TODO not finished. this is a simplified implementation
	 * as not all actions are formatting actions
	 *
	 * Extracts the intended aloha action from a dom element.
	 * Will look through the classes to find an aloha-action-* class, which is
	 * then transformed into an action object that looks like the following:
	 * { format: true, node: 'b' }
	 *
	 * @private
	 * @param  {!Element} element
	 * @return {?Object}
	 */
	function parseAction(element) {
		var action = {};
		var className;
		var classes = Arrays.coerce(element.classList).concat(Arrays.coerce(element.parentNode.classList));

		for (var i = 0; i < classes.length; i++) {
			className = classes[i];
			if (className.indexOf(CLASS_PREFIX) === 0) {
				action.format = className.substr(CLASS_PREFIX.length);
				return action;
			}
		}

		return null;
	}

	/**
	 * Transforms an array of dom nodes into an array of node names
	 * for faster iteration, eg:
	 *
	 * [text, h1, text, p] // array contains DOM nodes
	 *
	 * will return:
	 *
	 * ['P', '#text', 'H1']
	 *
	 * Duplicate entries will be removed, as displayed in the example
	 * above.
	 *
	 * @private
	 * @param {!Array.<Element>} nodes
	 * @return {Array.<string>}
	 */
	function uniqueNodeNames(nodes) {
		var i = nodes.length;
		var arr = [];
		var added = {};
		while (i--) {
			if (!added[nodes[i].nodeName]) {
				arr.push(nodes[i].nodeName);
				added[nodes[i].nodeName] = true;
			}
		}
		return arr;
	}

	/**
	 * Updates the ui according to current state overrides.
	 *
	 * Sets to active all ui toolbar elements that match the current overrides.
	 *
	 * @private
	 * @param {!Array.<Boundary>} boundries
	 */
	function updateUi(boundaries) {
		var doc = Boundaries.document(boundaries[0]);
		var formatNodes = uniqueNodeNames(Dom.childAndParentsUntilIncl(
			Boundaries.container(boundaries[0]),
			function (node) {
				return node.parentNode && Dom.isEditingHost(node.parentNode);
			}
		));

		/**
		 * Finds the root ul of a bootstrap dropdown menu
		 * starting from an entry node within the menu.
		 * Returns true until the node is found. Meant to
		 * be used with Dom.upWhile().
		 *
		 * @private
		 * @param {!Node} node
		 * @return {boolean}
		 */
		function isDropdownUl(node) {
			return Array.prototype.indexOf.call(node.classList, 'dropdown-menu') === -1;
		}

		Array.prototype.forEach.call(
			doc.querySelectorAll('.aloha-ui-toolbar .active'),
			function (node) {
				Dom.removeClass(node, 'active');
			}
		);

		formatNodes.forEach(function (format) {
			// update buttons
			var buttons = doc.querySelectorAll('.aloha-ui-toolbar .' + CLASS_PREFIX + format),
				i = buttons.length;
			while (i--) {
				buttons[i].className += ' active';
			}

			// update dropdowns
			var dropdownEntries = doc
				.querySelectorAll('.aloha-ui-toolbar .dropdown-menu .' + CLASS_PREFIX + format),
				dropdownRoot;
			i = dropdownEntries.length;
			while (i--) {
				dropdownRoot = Dom.upWhile(dropdownEntries[i], isDropdownUl).parentNode;
				dropdownRoot.querySelector('.dropdown-toggle').firstChild.data =
					dropdownEntries[i].innerText + ' ';
			}
		});
	}

	/**
	 * Handles UI updates invoked by event
	 *
	 * @param  {!AlohaEvent} event
	 * @return {AlohaEvent}
	 */
	function handle(event) {
		var boundaries = event.lastEditableBoundaries;
		if (!boundaries || !('keyup' === event.type || 'click' === event.type)) {
			return event;
		}
		if (Dom.hasClass(event.nativeEvent.target, 'aloha-ephemera')) {
			return event;
		}
		var action = parseAction(event.nativeEvent.target);
		if (action) {
			event.boundaries = execute(action, boundaries, event.editor);
		}
		if (event.boundaries) {
			updateUi(event.boundaries);
		}
		return event;
	}

	aloha.editor.stack = [
		Selections.handle,
		handle,
		Typing.handle,
		Blocks.handle,
		DragDrop.handle,
		Paste.handle,
		Editables.handle,
		Keys.handle,
		Mouse.handle
	];
}(aloha));