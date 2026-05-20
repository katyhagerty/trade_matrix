Goal: create a tool to build a trade matrix

At work, I use AFSIM to run simulations. These runs involving setting up scenarios with many variables. To determine how many scenarios are needed, we build a trade matrix--a table of all the values for each variable of interested. That's the "scientific method" piece. In order to study the impact of each value of each variable we need to make sure there are simulations where only that one variable changed. On top of that, some variables depend on others. For instance, if variable A is this value then variable will be this. There needs to be a way to capture those relations.

I need a tool to create a trade matrix which will include all combinations of variables but also allow me to set variables that depend on others. 

I would like this tool to have a UI