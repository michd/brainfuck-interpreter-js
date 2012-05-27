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
	//closure that just takes the brainfuck code and takes care of it from there
	//possibly unnecessary 
	var brainfuck = function(brainfuckProgram) {		
		
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
			for (var i = 0; i < byteCount; i += 1) {
				ram[i] = 0x00;
			}

			//current address of the pointer
			var pointerAddress = 0; 

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

			//Interface
			return {
				"incPointer": function() { incrementPointer(); },
				"decPointer": function() { decrementPointer(); },
				"incByte": function() { incrementByte(); },
				"decByte": function() { decrementByte(); },
				"writeByte": function(inputByte) { writeByte(inputByte); },
				"readByte": function() { return readByte(); },
			};

		}

		// A wrapper for outputting things as well as accepting input
		var userInterface = function() {

			// Prints the ascii character for a given byte
			function print(outputByte) {
				document.getElementById('output-display').value += 
					String.fromCharCode(outputByte);
			}

			// Waits for keyboard input,
			// then calls callback function with captured input as param
			function input(callback) {
				var outputDisplay = document.getElementById('output-display');
				outputDisplay.focus();
				outputDisplay.onkeydown = function(event) {
					event.preventDefault();
					outputDisplay.onkeydown = function() { };					
					callback(event.keyCode);
				}
			}

			// Interface
			return {
				"print": function(outputByte) { print(outputByte); },					
				"input": function(callback) { input(callback); }
			}
		};

		// Executes the program, keeps track of program pointer and sends data around
		var program = function(code, ram, ui) {
			
			var instructions = code;
			//program pointer
			var pointerAddress = 0;

			//Kills program execution in case of an error
			//Displays an alert message and resets the program pointer to 0
			function die(message) {
				alert(message);
				pointerAddress = 0;				
			}

			//Go to the next step in the program and execute if not at end
			function incrementPointer() {
				pointerAddress += 1;
				if(pointerAddress < instructions.length) {
					executeCommand();
				}
				else {
					window.console.log('Brainfuck program finished.');
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
								executeCommand(); 
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
								executeCommand(); 
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

			//Executes the command where the program pointer is currently pointing
			function executeCommand() {
				switch(instructions[pointerAddress]) {
					case ">": //Increment data pointer
						ram.incPointer();
						incrementPointer();
						break;
					case "<": //Decrement data pointer
						ram.decPointer();
						incrementPointer();
						break;
					case "+": //Increment value at data pointer
						ram.incByte();
						incrementPointer();
						break;
					case "-": //Decrement value at data pointer
						ram.decByte();
						incrementPointer();
						break;
					case ".": //output the character the current byte represents
						ui.print(ram.readByte());
						incrementPointer();
						break;
					case ",": //Take input and store in current data cell
						//ram.writeByte as callback function since input will be async
						ui.input(function(inputByte) {
							ram.writeByte(inputByte);
							incrementPointer();
						});
						break;
					case "[": //if current byte == 0, jump to command after matching "]"
						//otherwise, go to next command
						if(ram.readByte() === 0x00) {
							jumpToClosingBracket();
						}
						else {
							incrementPointer();
						}
						break;
					case "]": //if current byte != 0, jump to command after matching "["
						//otherwise, go to next command
						if(ram.readByte() !== 0x00) {
							jumpToOpeningBracket();
						}
						else {
							incrementPointer();
						}
						break;
					default: //Do nothing, just advance program. 
						//(Occurs when end is reached)
						incrementPointer();					
				}
			}

			//Interface
			return {
				"execute": function() { 					
					executeCommand(); 
				}
			};
		}


		//Set it all up
		var processor = new program(
			cleanCode(brainfuckProgram), 
			new workingMemory(2048), //Set desired number of bytes in memory here
			new userInterface()
		).execute();	

	}

	//Clear button
	document.getElementById('brainfuck-clear').onclick = function(event) {
		event.preventDefault();
		document.getElementById('brainfuck-input').value = '';
	};

	//Run button, basically.
	document.getElementById('input-form').onsubmit = function(event) {
		event.preventDefault();		
		brainfuck(document.getElementById('brainfuck-input').value);
	}

})();