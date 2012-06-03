/* brainfuck.js */

// Add indexOf support if not available
// From https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
		"use strict";
		if (this == null) {
			throw new TypeError();
		}
		var t = Object(this);
		var len = t.length >>> 0;
		if (len === 0) {
			return -1;
		}
		var n = 0;
		if (arguments.length > 0) {
			n = Number(arguments[1]);
			if (n != n) { // shortcut for verifying if it's NaN
				n = 0;
			}
			else if (n != 0 && n != Infinity && n != -Infinity) {
				n = (n > 0 || -1) * Math.floor(Math.abs(n));
			}
		}
		if (n >= len) {
			return -1;
		}
		var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
		for (; k < len; k++) {
			if (k in t && t[k] === searchElement) {
				return k;
			}
		}
		return -1;
	}
}

(function() {
	var g_processCnt = 0;
	//closure that just takes the brainfuck code and takes care of it from there
	//possibly unnecessary 
		
		
	// Strips all non-brainfuck characters from a given string 
	var cleanCode = function(dirtyCode) {
		var legalChars = [">", "<", "+", "-", ".", ",", "[", "]"];
		var output = '';
		for(var i = 0; i < dirtyCode.length; i += 1) {
			if(legalChars.indexOf(dirtyCode[i]) !== -1) {
				output += dirtyCode[i];
			}
		}
		return output;
	};		


	//Working memory (RAM) controller
	//Takes care of:
	// Moving data pointer, incrementing/decrementing value at data location,
	// Reading, writing data		
	var workingMemory = function(byteCount) {		
		// Array working acting as memory bank
		var ram = [];
		var ramAllFormats = []; //only populated and updated when the debug function 
		//requests asks for it
		
		var pointerAddress = 0;

		function initialize() {
			for (var i = 0; i < byteCount; i += 1) {
				ram[i] = 0x00;
			}

			//current address of the pointer
			pointerAddress = 0;	 	
		}

		//moves pointer to the right, reverting to 0 if end is reached
		function incrementPointer() {
			pointerAddress += 1;
			if(pointerAddress >= ram.length) {
				pointerAddress = 0;
			} 
		}

		//moves pointer to the left, reverting to last cell if end is reached
		function decrementPointer() {
			pointerAddress -= 1;
			if(pointerAddress < 0) {
				pointerAddress = ram.length - 1;
			}
		}

		// Add one to the currently active byte, goes back to 0x00 
		// if more than 0xFF
		function incrementByte() {
			ram[pointerAddress] += 1;
			if(ram[pointerAddress] > 0xFF)	{
				ram[pointerAddress] = 0x00;
			}
		}

		//subtract one from the currently active byte, goes to 0xFF if less than 
		// 0x00
		function decrementByte() {
			ram[pointerAddress] -= 1;
			if(ram[pointerAddress] < 0x00) {
				ram[pointerAddress] = 0xFF;
			}
		}

		// Writes a single byte from given input, to the current data cell in the
		// memory
		// Attempts to form the data into a single byte
		function writeByte(inputByte) {
			inputByte = Math.round(inputByte);
			if(inputByte >= 0x00) {
				if(inputByte <= 0xFF) {
					ram[pointerAddress] = inputByte;
				}
				else {
					// Get the 8 least significant bits by bit-wise and of 8 ones
					ram[pointerAddress] = 0xFF & inputByte;
				}
			}
			else {
				// TODO: find out how signed integers are normally treated
				ram[pointerAddress] = 0xFF & inputByte;
			}
		}

		// Returns the current byte from memory
		function readByte() {
			return ram[pointerAddress];
		}

		initialize();

		//Interface
		return {
			"incPointer": function() { incrementPointer(); },
			"decPointer": function() { decrementPointer(); },
			"incByte": function() { incrementByte(); },
			"decByte": function() { decrementByte(); },
			"writeByte": function(inputByte) { writeByte(inputByte); },
			"readByte": function() { return readByte(); },
			"reset": function() { initialize(); },
			"debug": {
				"dumpMemory": function() {
					return ram;
				},
				"dumpMemoryFormats": function() {
					if(ramAllFormats.length == 0) {
						for(var i = 0; i < ram.length; i += 1) {
							ramAllFormats.push({
								"dec": 0,
								"hex": "0x00",
								"bin": "0b00000000",
								"ascii": String.fromCharCode(0)
							});
						}
					}
					
					for (var j = 0; j < ram.length; j += 1) {
						if(ramAllFormats[j].dec != ram[j]) {
							ramAllFormats[j] = {
								"dec": ram[j],
								"hex": '0x' + ((ram[j] < 16) ? '0' : '') + 
									ram[j].toString(16).toUpperCase(),
								"bin": '0b' + 
									new Array(9 - ram[j].toString(2).length).join('0') + 
									ram[j].toString(2),
								"ascii": String.fromCharCode(ram[j])
							};
						}
					}
					return ramAllFormats;					
				},
				"getPointerAddress": function() { return pointerAddress; }
			}
		};

	}

	// A wrapper for outputting things as well as accepting input
	var userInterface = function() {

		var outputDisplay = document.getElementById('output-display');

		// Prints the ascii character for a given byte
		function print(outputByte) {
			outputDisplay.value += String.fromCharCode(outputByte);

		}

		// Waits for keyboard input,
		// then calls callback function with captured input as param
		function input(callback) {
			
			outputDisplay.focus();
			outputDisplay.onkeypress = function(event) {
				event.preventDefault();
				outputDisplay.onkeypress = function() { };					
				callback(event.charCode);
			}
		}

		function resetInput() {
			outputDisplay.onkeypress = function(event) { };
		}

		function resetOutput() {
			outputDisplay.value = '';
		}

		// Interface
		return {
			"print": function(outputByte) { print(outputByte); },					
			"input": function(callback) { input(callback); },
			"resetInput": function() { resetInput(); },
			"resetOutput": function() { resetOutput(); }
		}
	};

	// Executes the program, keeps track of program pointer and sends data around
	var program = function(code, ram, ui) {
		var STATUSES = {
			'RUNNING': 'running',
			'STEPPING': 'stepping',
			'PAUSED': 'paused',
			'STOPPED': 'stopped',
			'READY': 'ready'
		};

		var status = STATUSES['READY'];

		var stepDelay = 0;
		var stepTimeout;

		var instructions = code;		
		var pointerAddress = 0; //program pointer

		var throttleInstructionCnt = 0;
		var throttleTimeout;

		var THROTTLE_THRESHOLD = 1000;

		
		ui.resetOutput(); //clear output

		//Kills program execution in case of an error
		//Displays an alert message and resets the program pointer to 0
		function die(message) {
			stop();
			alert(message);		
		}

		//Go to the next step in the program and execute if not at end
		//if halt is set and true, don't run executeCommand
		function incrementPointer() {			
			pointerAddress += 1;
			if(pointerAddress >= instructions.length) {			
				window.console.log('Brainfuck program finished.');
				status = STATUSES['STOPPED'];
			}
		}

		//Locates a closing bracket "]" in the program and sets the pointer
		//to the command after that bracket.
		//If no matching closing bracket is found, kill execution
		//TODO: look into making this more efficient if possible
		function jumpToClosingBracket() {			
			var depth = 1;
			var openingBracketPosition = pointerAddress;
			pointerAddress += 1;
			while(pointerAddress < instructions.length) {					
				switch(instructions[pointerAddress]) {
					case "[":
						depth += 1;
						break;
					case "]":
						depth -= 1;
						if(depth == 0) {
							pointerAddress += 1;							
							return;
						}
						break;
					default:							
						break;
				}
				pointerAddress += 1;
			}				
			die(
				'Fatal error: unmatched bracket at instruction ' + 
				openingBracketPosition
			);
		}

		// Similar to jumpToClosingBracket, Locates the opening bracket "[" in the
		// program and sets the pointer to the command after that bracket.
		// If no matching opening bracket is found, kill execution
		// TODO: look into making this more efficient if possible
		function jumpToOpeningBracket() {
			
			var depth = 1;
			var closingBracketPosition = pointerAddress;
			pointerAddress -= 1;
			while(pointerAddress >= 0) {					
				switch(instructions[pointerAddress]) {
					case "]":
						depth += 1;
						break;
					case "[":
						depth -= 1;
						if(depth == 0) {
							pointerAddress += 1;							
							return;
						}
						break;
					default:							
						break;
				}
				pointerAddress -= 1;
			}				
			die(
				'Fatal error: unmatched bracket at instruction ' + 
				closingBracketPosition
			);
		}

		function cycle() {			
			var advancePointer = executeCommand();
			if(advancePointer) {
				incrementPointer();
			}
			switch(status) {
				case STATUSES['RUN']:
					throttleInstructionCnt += 1;
					if(throttleInstructionCnt == THROTTLE_THRESHOLD) {
						throttleInstructionCnt = 0;
						delayExecution();
					}
					else {
						cycle();
					}
					break;

				case STATUSES['STEPPING']:
					stepTimeout = setTimeout(function() { 
							cycle(); 
						}, 
						stepDelay
					);
					break;
				
				case STATUSES['PAUSED']:
					break;

				case STATUSES['STOPPED']:
					if(pointerAddress != instructions.length) {
						pointerAddress = instructions.length;
					}
					break;
			}
			return;
		}

		function run() {
			if(status !== STATUSES['RUN']) {
				status = STATUSES['RUN'];
				cycle();
			}
		}

		function step() {
			status = STATUSES['PAUSED'];
			clearTimeout(throttleTimeout);
			clearTimeout(stepTimeout);
			cycle();
		}

		function slowRun(delay) {
			status = STATUSES['STEPPING'];
			stepDelay = delay;
			clearTimeout(throttleTimeout);
			clearTimeout(stepTimeout);
			cycle();
		}

		function pause() {
			status = STATUSES['PAUSED'];
			clearTimeout(throttleTimeout);
			clearTimeout(stepTimeout);
		}

		function stop() {			
			status = STATUSES['STOPPED'];
			clearTimeout(throttleTimeout);
			clearTimeout(stepTimeout);
			ui.resetInput();
			pointerAddress = instructions.length;
		}

		function reset() {
			status = STATUSES['READY'];
			ui.resetOutput();
			ui.resetInput();
			ram.reset();
			pointerAddress = 0;
			clearTimeout(throttleTimeout);
			clearTimeout(stepTimeout);
		}

		function delayExecution() {
			throttleTimeout = setTimeout(function() { cycle(); }, 5);
		}

		//Executes the command where the program pointer is currently pointing
		function executeCommand() {			
			switch(instructions[pointerAddress]) {
				case ">": //Increment data pointer						
					ram.incPointer();
					return true;												
				case "<": //Decrement data pointer
					ram.decPointer();
					return true;						
				case "+": //Increment value at data pointer
					ram.incByte();						
					return true;
				case "-": //Decrement value at data pointer
					ram.decByte();						
					return true;
				case ".": //output the character the current byte represents
					ui.print(ram.readByte());
					return true;
				case ",": //Take input and store in current data cell
					//ram.writeByte as callback function since input will be async
					ui.input(function(inputByte) {
						ram.writeByte(inputByte);
						incrementPointer();
					});
					return false;
				case "[": //if current byte == 0, jump to command after matching "]"
					//otherwise, go to next command
					if(ram.readByte() === 0x00) {
						jumpToClosingBracket();
						return false;
					}						
					return true;						
				case "]": //if current byte != 0, jump to command after matching "["
					//otherwise, go to next command
					if(ram.readByte() !== 0x00) {
						jumpToOpeningBracket();
						return false;
					}
					return true;
				default: //Do nothing, just advance program. 
					//(Occurs when end is reached)
					return true;
			}		
		}

		//Interface
		return {
			"run": function() { 					
				run(); 
			},			
			"step": function() {
				step();
			},
			"pause": function() {
				pause();
			},
			"stop": function() {
				stop();
			},
			"autoStep": function(delay) {
				slowRun(delay);
			},
			"reset": function() {
				reset();
			},
			"debug":  {
				"status": function() { return status; },
				"getPointerAddress": function() { return pointerAddress; },
				"getCleanProgram": function() { return instructions; },
				"memory": ram.debug
			}
		};
	}


		
	var process = null;
	var debugInterval = null;	
	var MEMORY_SIZE = 512;


	function updateProgramPosition() {
		var processCode = process.debug.getCleanProgram();
			var highlighted = processCode.substr(0, process.debug.getPointerAddress()) +
				'<span class="current-instruction">' + 
				processCode.substr(process.debug.getPointerAddress(), 1)  +
				'</span>' +
				processCode.substr(process.debug.getPointerAddress() + 1);
			document.getElementById('program-position').innerHTML = highlighted;
	}

	function updateMemoryTable() {
		var ramPointer = process.debug.memory.getPointerAddress();
		var ramDumpFormats = process.debug.memory.dumpMemoryFormats();
		
		//populate table with rows if they are not present yet.
		//otherwise, update the table data with new data
		var tableBody = document.getElementById('memory-table').getElementsByTagName('tbody')[0];

		if(tableBody.getElementsByTagName('tr').length == 0) {
			//not initialized
			var row, addressTd, decTd, hexTd, binTd, asciiTd;
			for(var j = 0; j < ramDumpFormats.length; j += 1) {
				row = document.createElement('tr');
				if(j == ramPointer) {
					row.className = 'current-address';
				}
				addressTd = row.appendChild(document.createElement('td'));
				addressTd.innerHTML = j;
				decTd = row.appendChild(document.createElement('td'));
				decTd.innerHTML = ramDumpFormats[j].dec;
				hexTd = row.appendChild(document.createElement('td'));
				hexTd.innerHTML = ramDumpFormats[j].hex;
				binTd = row.appendChild(document.createElement('td'));
				binTd.innerHTML = ramDumpFormats[j].bin;
				asciiTd = row.appendChild(document.createElement('td'));
				asciiTd.innerHTML = ramDumpFormats[j].ascii;
				tableBody.appendChild(row);
			}
		}
		else {
			var rows = tableBody.getElementsByTagName('tr');
			var cells;
			for(var j = 0; j < ramDumpFormats.length; j+= 1) {
				rows[j].className = (ramPointer == j) ? 'current-address' : '';
				cells = rows[j].getElementsByTagName('td');				
				if(cells[1].innerHTML != ramDumpFormats[j].dec) { 
					cells[0].innerHTML = j; 
					cells[1].innerHTML = ramDumpFormats[j].dec;
					cells[2].innerHTML = ramDumpFormats[j].hex;		
					cells[3].innerHTML = ramDumpFormats[j].bin;
					cells[4].innerHTML = ramDumpFormats[j].ascii;
				}							
			}
		}
	}

	function initializeProcess() {
		if (process != null) {
			process.reset();			
		}
		
		process = program(
			cleanCode(document.getElementById('brainfuck-input').value), 
			workingMemory(MEMORY_SIZE), //Set desired number of bytes in memory here
			userInterface()
		);	
		
		clearInterval(debugInterval);		
		
		
		debugInterval = setInterval(function() {
			updateProgramPosition();
			updateMemoryTable();
		}, 100);

	}



	//Clear button
	document.getElementById('brainfuck-clear').onclick = function(event) {
		event.preventDefault();
		document.getElementById('brainfuck-input').value = '';
	};

	//Run button
	document.getElementById('brainfuck-run').onclick = function(event) {
		event.preventDefault();		
		if(process == null) {
			initializeProcess();
		}
		process.run();			
	}

	//Step button
	document.getElementById('brainfuck-step').onclick = function(event) {
		event.preventDefault();
		if(process == null) {
			initializeProcess();
		}
		process.step();		
	}

	//Step auto button
	document.getElementById('brainfuck-step-auto').onclick = function(event) {
		event.preventDefault();
		if(process == null) {
			initializeProcess();
		}
		process.autoStep(
			parseInt(document.getElementById('brainfuck-step-interval').value, 10)
		);		
	}

	//(re-)Initialize button
	document.getElementById('brainfuck-init').onclick = function(event) {
		event.preventDefault();
		initializeProcess();				
	}

	//Pause button
	document.getElementById('brainfuck-pause').onclick = function(event) {
		event.preventDefault();		
		process.pause();
	}

	//Stop button
	document.getElementById('brainfuck-stop').onclick = function(event) {
		event.preventDefault();		
		process.stop();
	}

})();