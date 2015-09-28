/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved. 
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *   
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *   
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

/// <reference path="../_references.ts"/>

module powerbi.visuals {
    export class BISmartChord implements IVisual {

        //private static VisualClassName = 'chordByBISmart';
        private element: JQuery;
        private dataView: DataView;

        // converts data from Values to two dimensional array
        // expected order: MemberFrom MemberTo Value Valu2 (optional - for coloring)
        public static converter(dataView: DataView): any {
            var data = new Array();

            var index;
            var rws = dataView.table.rows;
            for (index = 0; index < rws.length; ++index) {
                try {
                    var row = rws[index];
                    var temp;
                    temp = [];
                    var color = 1;
                    if (row[3] != null) {
                        color = row[3];
                    }
                    temp = [row[0], row[1], row[2], color, 1];
                    data.push(temp);
                }
                catch (e) {
                }
            }
            return data;
        }

        public init(options: VisualInitOptions): void {
            this.element = options.element;
        }

        public onResizing(viewport: IViewport) { /* This API will be depricated */ }

        public update(options: VisualUpdateOptions) {
            // convert dataview into array from dataview    
            var data = BISmartChord.converter(this.dataView = options.dataViews[0]);
            var membersFrom = [];
            var membersTo = [];

            // visual initialization
            var viewport = options.viewport;
            var w = viewport.width,
                h = viewport.height,
                r1 = Math.min(w, h) / 2 - 4,
                r0 = r1 - 20;

            var format = d3.format(",.3r");
            var layout = d3.layout.chord()
                .sortSubgroups(d3.descending)
                .sortChords(d3.descending)
                .padding(.04);

            var fill = d3.scale.ordinal()
                .domain([0, 1, 2])
                .range(["#DB704D", "#D2D0C6", "#ECD08D"]);
                
            // set color pallete based on min/max values    
            var colorScale = d3.scale.category10()
                .domain([d3.min(data, function (d) { return d[3]; }), d3.max(data, function (d) { return d[3]; })]);

            var arc = d3.svg.arc()
                .innerRadius(r0)
                .outerRadius(r1);

            var chord = d3.svg.chord()
                .radius(r0);

            // remove previosu paths
            d3.select(this.element.get(0)).selectAll("svg").remove();

            // bind to membersTo (also could be changed to membersFrom preference)
            var svg = d3.select(this.element.get(0)).selectAll("svg")
                .data([membersTo])
                .enter().append("svg:svg")
                .attr("width", w)
                .attr("height", h)
                .append("svg:g")
                .attr("transform", "translate(" + w / 2 + "," + h / 2 + ")");

            d3.select(this.element.get(0)).selectAll("svg")
                .attr("width", w)
                .attr("height", h);

            d3.select(this.element.get(0)).selectAll("svg").select("g")
                .attr("transform", "translate(" + w / 2 + "," + h / 2 + ")");

            var members = {},
                array = [],
                n = 0;

            var dataMembers = new Array();

            // Compute the row number for each unique member
            data.forEach(function (d) { createMember(d[0]); });
            data.forEach(function (d) { createMember(d[1]); }); 
            
            // convert data array into objects             
            data.forEach(function (d) {
                var x;
                x = { memberFrom: null, memberTo: null, risk: null, amount: null, valueOf: null, aux: null };

                x.memberFrom = createMember(d[0]);
                x.memberTo = createMember(d[1]);
                x.memberTo.risk = 1;
                x.risk = d[3];
                x.amount = d[2];
                x.valueOf = value;
                x.aux = d[4];
                dataMembers.push(x);
            });
            
            // Initialize a square matrix of membersFrom and membersTo
            for (var i = 0; i < n; i++) {
                membersFrom[i] = [];
                membersTo[i] = [];
                for (var j = 0; j < n; j++) {
                    membersFrom[i][j] = 0;
                    membersTo[i][j] = 0;
                }
            }

            // Populate the matrices
            dataMembers.forEach(function (d) {
                membersFrom[d.memberFrom.id][d.memberTo.id] = d;
                membersTo[d.memberFrom.id][d.memberTo.id] = d;
                membersTo[d.memberTo.id][d.memberFrom.id] = d;
                array[d.memberFrom.id] = d.memberFrom;
                array[d.memberTo.id] = d.memberTo;
            });

            // create unique ID for each member
            function createMember(d) {
                return members[d] || (members[d] = {
                    name: d,
                    id: n++
                });
            }
            // int value
            function value() {
                return +this.amount;
            }
            
            // draw chord 
            svg.each(function (matrix, j) {
                var svg = d3.select(this);

                // Compute the chord layout.
                layout.matrix(matrix);

                // Add chords
                svg.selectAll("path.chord")
                    .data(layout.chords)
                    .enter().append("svg:path")
                    .attr("class", "chord")
                    .style("fill", function (d) { return colorScale(d.source.value.risk); })
                    .style("stroke", function (d) { return d3.rgb(fill(d.source.value.aux)).darker(); })
                    .attr("d", chord)
                    .append("svg:title")
                    .text(function (d) { return d.source.value.memberTo.name + " to " + d.source.value.memberFrom.name + " " + format(d.source.value) + ""; });

                // Add groups
                var g = svg.selectAll("g.group")
                    .data(layout.groups)
                    .enter().append("svg:g")
                    .attr("class", "group");

                g.append("svg:path")
                    .style("fill", function (d) { return fill(array[d.index].risk); })
                    .attr("id", function (d, i) { return "group" + d.index + "-" + j; })
                    .attr("d", arc)
                    .on("mouseover", setOpacity(0.2))
                    .on("mouseout", setOpacity(1))
                    .append("svg:title")
                    .text(function (d) { return array[d.index].name + " - " + format(d.value) + ""; });

                g.append("svg:text")
                    .attr("x", 6)
                    .attr("dy", 15)
                    .on("mouseover", setOpacity(0.2))
                    .on("mouseout", setOpacity(1))
                // when not to show group title
                    .filter(function (d) { return d.value > 110; })
                    .append("svg:textPath")
                    .attr("xlink:href", function (d) { return "#group" + d.index + "-" + j; })
                    .text(function (d) { return array[d.index].name; });

            });
        }
    }

    function setOpacity(opacity) {
        return function (g, i) {
            d3.selectAll("path")
                .filter(function (d) { return d.target != null && d.source != null && d.source.index !== i && d.target.index !== i; })
                .transition()
                .style("opacity", opacity);
        };
    }

}
